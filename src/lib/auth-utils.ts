import { db } from "@/db";
import {
  whatsappMemberTable,
  whatsappTable,
  platformConfigTable,
  userConfigTable,
  type WhatsappMemberRole,
} from "@/db/schema";
import { and, eq, count } from "drizzle-orm";

// Re-export the type
export type { WhatsappMemberRole };
import { auth } from "./auth";
import { headers } from "next/headers";

// Role hierarchy for permissions
const roleHierarchy: Record<WhatsappMemberRole, number> = {
  owner: 3,
  manager: 2,
  agent: 1,
};

export type InstancePermission =
  | "view"
  | "send_messages"
  | "manage_retention"
  | "manage_connections"
  | "manage_config"
  | "manage_agents"
  | "manage_managers"
  | "manage_owners"
  | "delete_instance";

// Permissions per role
const rolePermissions: Record<WhatsappMemberRole, InstancePermission[]> = {
  agent: ["view", "send_messages", "manage_retention"],
  manager: [
    "view",
    "send_messages",
    "manage_retention",
    "manage_connections",
    "manage_config",
    "manage_agents",
    "manage_managers",
  ],
  owner: [
    "view",
    "send_messages",
    "manage_retention",
    "manage_connections",
    "manage_config",
    "manage_agents",
    "manage_managers",
    "manage_owners",
    "delete_instance",
  ],
};

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}

/**
 * Get the current session user
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Check if user is a platform admin
 */
export function isPlatformAdmin(user: SessionUser): boolean {
  return user.role === "admin";
}

/**
 * Require platform admin role
 */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!isPlatformAdmin(user)) {
    throw new Error("Admin access required");
  }
  return user;
}

/**
 * Get member role for a user in a WhatsApp instance
 */
export async function getInstanceRole(
  whatsappId: string,
  userId: string
): Promise<WhatsappMemberRole | null> {
  const member = await db.query.whatsappMemberTable.findFirst({
    where: and(
      eq(whatsappMemberTable.whatsappId, whatsappId),
      eq(whatsappMemberTable.userId, userId)
    ),
  });

  return member?.role ?? null;
}

/**
 * Check if user has at least a specific role level in an instance
 */
export function hasMinimumRole(
  userRole: WhatsappMemberRole | null,
  requiredRole: WhatsappMemberRole
): boolean {
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user has a specific permission in an instance
 */
export function hasPermission(
  userRole: WhatsappMemberRole | null,
  permission: InstancePermission
): boolean {
  if (!userRole) return false;
  return rolePermissions[userRole].includes(permission);
}

/**
 * Require a minimum role level for an instance
 */
export async function requireInstanceRole(
  whatsappId: string,
  requiredRole: WhatsappMemberRole,
  user?: SessionUser
): Promise<{ user: SessionUser; role: WhatsappMemberRole }> {
  const sessionUser = user ?? (await requireAuth());

  // Platform admins have full access
  if (isPlatformAdmin(sessionUser)) {
    return { user: sessionUser, role: "owner" };
  }

  const role = await getInstanceRole(whatsappId, sessionUser.id);

  if (!hasMinimumRole(role, requiredRole)) {
    throw new Error(
      `Insufficient permissions. Required role: ${requiredRole}`
    );
  }

  return { user: sessionUser, role: role! };
}

/**
 * Require a specific permission for an instance
 */
export async function requireInstancePermission(
  whatsappId: string,
  permission: InstancePermission,
  user?: SessionUser
): Promise<{ user: SessionUser; role: WhatsappMemberRole }> {
  const sessionUser = user ?? (await requireAuth());

  // Platform admins have full access
  if (isPlatformAdmin(sessionUser)) {
    return { user: sessionUser, role: "owner" };
  }

  const role = await getInstanceRole(whatsappId, sessionUser.id);

  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permissions for: ${permission}`);
  }

  return { user: sessionUser, role: role! };
}

/**
 * Get WhatsApp instance by ID with role verification
 */
export async function getWhatsappWithRole(
  whatsappId: string,
  requiredRole: WhatsappMemberRole = "agent"
) {
  const { user, role } = await requireInstanceRole(whatsappId, requiredRole);

  const wa = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.id, whatsappId),
  });

  if (!wa) {
    throw new Error("WhatsApp instance not found");
  }

  return { wa, user, role };
}

/**
 * Get WhatsApp instance by slug with role verification
 */
export async function getWhatsappBySlugWithRole(
  slug: string,
  requiredRole: WhatsappMemberRole = "agent"
) {
  const user = await requireAuth();

  const wa = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, slug),
  });

  if (!wa) {
    throw new Error("WhatsApp instance not found");
  }

  // Platform admins have full access
  if (isPlatformAdmin(user)) {
    return { wa, user, role: "owner" as WhatsappMemberRole };
  }

  const role = await getInstanceRole(wa.id, user.id);

  if (!hasMinimumRole(role, requiredRole)) {
    throw new Error(
      `Insufficient permissions. Required role: ${requiredRole}`
    );
  }

  return { wa, user, role: role! };
}

/**
 * Check if user can create WhatsApp instances
 */
export async function canCreateWhatsapp(userId: string): Promise<boolean> {
  // Get platform config
  const platformConfig = await db.query.platformConfigTable.findFirst();

  // Get user config
  const userConfig = await db.query.userConfigTable.findFirst({
    where: eq(userConfigTable.userId, userId),
  });

  // Resolve canCreate permission
  const canCreate =
    userConfig?.canCreateWhatsapp ?? platformConfig?.allowUserCreateWhatsapp ?? true;

  if (!canCreate) {
    return false;
  }

  // Resolve max instances limit
  const maxInstances =
    userConfig?.maxWhatsappInstances ??
    platformConfig?.defaultMaxWhatsappInstances ??
    0;

  // 0 = unlimited
  if (maxInstances === 0) {
    return true;
  }

  // Count current instances
  const [result] = await db
    .select({ count: count() })
    .from(whatsappTable)
    .where(eq(whatsappTable.userId, userId));

  return (result?.count ?? 0) < maxInstances;
}

/**
 * Get platform configuration (with defaults)
 */
export async function getPlatformConfig() {
  try {
    const config = await db.query.platformConfigTable.findFirst();

    return {
      allowRegistration: config?.allowRegistration ?? false,
      allowUserCreateWhatsapp: config?.allowUserCreateWhatsapp ?? true,
      defaultMaxWhatsappInstances: config?.defaultMaxWhatsappInstances ?? 0,
    };
  } catch {
    // Table might not exist yet, return defaults
    return {
      allowRegistration: false,
      allowUserCreateWhatsapp: true,
      defaultMaxWhatsappInstances: 0,
    };
  }
}

/**
 * Get resolved user configuration (merging platform and user-specific)
 */
export async function getResolvedUserConfig(userId: string) {
  const platformConfig = await getPlatformConfig();
  const userConfig = await db.query.userConfigTable.findFirst({
    where: eq(userConfigTable.userId, userId),
  });

  return {
    canCreateWhatsapp:
      userConfig?.canCreateWhatsapp ?? platformConfig.allowUserCreateWhatsapp,
    maxWhatsappInstances:
      userConfig?.maxWhatsappInstances ??
      platformConfig.defaultMaxWhatsappInstances,
  };
}

/**
 * Get all members of a WhatsApp instance
 */
export async function getInstanceMembers(whatsappId: string) {
  return db.query.whatsappMemberTable.findMany({
    where: eq(whatsappMemberTable.whatsappId, whatsappId),
    with: {
      user: true,
      createdByUser: true,
    },
  });
}

/**
 * Check if a role can manage another role
 */
export function canManageRole(
  managerRole: WhatsappMemberRole,
  targetRole: WhatsappMemberRole
): boolean {
  // Owners can manage anyone
  if (managerRole === "owner") return true;

  // Managers can manage agents and other managers
  if (managerRole === "manager") {
    return targetRole === "agent" || targetRole === "manager";
  }

  // Agents cannot manage anyone
  return false;
}

/**
 * Check if a role can remove another role
 */
export function canRemoveRole(
  managerRole: WhatsappMemberRole,
  targetRole: WhatsappMemberRole
): boolean {
  // Owners can remove anyone except themselves (handled separately)
  if (managerRole === "owner") return true;

  // Managers can only remove agents
  if (managerRole === "manager") {
    return targetRole === "agent";
  }

  // Agents cannot remove anyone
  return false;
}
