import { Suspense } from "react";
import { db } from "@/db";
import { userTable, userConfigTable, whatsappTable } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, User } from "lucide-react";
import { getPlatformConfig } from "@/lib/auth-utils";
import { Spinner } from "@/components/ui/spinner";

async function getUsers() {
  try {
    const users = await db.query.userTable.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });

    // Get WhatsApp instance counts for each user
    const userIds = users.map((u) => u.id);
    const instanceCounts = await Promise.all(
      userIds.map(async (userId) => {
        const [result] = await db
          .select({ count: count() })
          .from(whatsappTable)
          .where(eq(whatsappTable.userId, userId));
        return { userId, count: result?.count ?? 0 };
      })
    );

    // Get user configs (might fail if table doesn't exist)
    let userConfigs: Awaited<ReturnType<typeof db.query.userConfigTable.findMany>> = [];
    try {
      userConfigs = await db.query.userConfigTable.findMany();
    } catch {
      // Table might not exist yet
    }

    return users.map((user) => ({
      ...user,
      instanceCount:
        instanceCounts.find((c) => c.userId === user.id)?.count ?? 0,
      config: userConfigs.find((c) => c.userId === user.id),
    }));
  } catch {
    // Tables might not exist yet
    return [];
  }
}

async function UsersContent() {
  const users = await getUsers();
  const platformConfig = await getPlatformConfig();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado
            {users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            Lista de todos los usuarios de la plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {user.role === "admin" ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {user.role === "admin" && (
                        <Badge variant="secondary" className="text-xs">
                          Admin
                        </Badge>
                      )}
                      {user.banned && (
                        <Badge variant="destructive" className="text-xs">
                          Baneado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <p className="font-medium">
                      {user.instanceCount} instancia
                      {user.instanceCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Límite:{" "}
                      {(user.config?.maxWhatsappInstances ??
                        platformConfig.defaultMaxWhatsappInstances) ||
                        "Ilimitado"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      user.config?.canCreateWhatsapp ??
                      platformConfig.allowUserCreateWhatsapp
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.config?.canCreateWhatsapp ??
                    platformConfig.allowUserCreateWhatsapp
                      ? "Puede crear"
                      : "No puede crear"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}
