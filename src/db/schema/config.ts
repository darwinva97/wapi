import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { userTable } from "./user";
import { whatsappTable } from "./whatsapp";

// Instance role enum type
export type WhatsappMemberRole = "owner" | "manager" | "agent";

// Storage type enum
export type StorageType = "local" | "s3";

// Platform configuration (singleton)
export const platformConfigTable = sqliteTable("platform_config", {
  id: text("id").primaryKey().default("default"),
  allowRegistration: integer("allow_registration", { mode: "boolean" })
    .notNull()
    .default(false),
  allowUserCreateWhatsapp: integer("allow_user_create_whatsapp", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  defaultMaxWhatsappInstances: integer("default_max_whatsapp_instances")
    .notNull()
    .default(0), // 0 = unlimited
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// User-specific configuration overrides
export const userConfigTable = sqliteTable(
  "user_config",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, { onDelete: "cascade" }),
    canCreateWhatsapp: integer("can_create_whatsapp", { mode: "boolean" }), // null = use global
    maxWhatsappInstances: integer("max_whatsapp_instances"), // null = use global
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_config_userId_idx").on(table.userId)]
);

// WhatsApp instance members (roles: owner, manager, agent)
export const whatsappMemberTable = sqliteTable(
  "whatsapp_member",
  {
    id: text("id").primaryKey(),
    whatsappId: text("whatsapp_id")
      .notNull()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    role: text("role").$type<WhatsappMemberRole>().notNull().default("agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    createdBy: text("created_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("whatsapp_member_whatsappId_idx").on(table.whatsappId),
    index("whatsapp_member_userId_idx").on(table.userId),
    index("whatsapp_member_whatsappId_userId_idx").on(
      table.whatsappId,
      table.userId
    ),
  ]
);

// WhatsApp cleanup configuration
export const whatsappCleanupConfigTable = sqliteTable(
  "whatsapp_cleanup_config",
  {
    whatsappId: text("whatsapp_id")
      .primaryKey()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    cleanupEnabled: integer("cleanup_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    cleanupDays: integer("cleanup_days").notNull().default(30),
    excludeChats: text("exclude_chats", { mode: "json" })
      .$type<string[]>()
      .default([]),
    includeOnlyChats: text("include_only_chats", { mode: "json" })
      .$type<string[]>()
      .default([]),
    forceCleanup: integer("force_cleanup", { mode: "boolean" })
      .notNull()
      .default(false),
    maxAgentRetentionDays: integer("max_agent_retention_days")
      .notNull()
      .default(90),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

// Chat-specific configuration
export const chatConfigTable = sqliteTable(
  "chat_config",
  {
    id: text("id").primaryKey(),
    whatsappId: text("whatsapp_id")
      .notNull()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    customName: text("custom_name"),
    cleanupExcluded: integer("cleanup_excluded", { mode: "boolean" })
      .notNull()
      .default(false),
    cleanupIncluded: integer("cleanup_included", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_config_whatsappId_idx").on(table.whatsappId),
    index("chat_config_whatsappId_chatId_idx").on(table.whatsappId, table.chatId),
  ]
);

// Chat notes
export const chatNoteTable = sqliteTable(
  "chat_note",
  {
    id: text("id").primaryKey(),
    whatsappId: text("whatsapp_id")
      .notNull()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    content: text("content").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_note_whatsappId_idx").on(table.whatsappId),
    index("chat_note_whatsappId_chatId_idx").on(table.whatsappId, table.chatId),
  ]
);

// Storage configuration (singleton)
export const storageConfigTable = sqliteTable("storage_config", {
  id: text("id").primaryKey().default("default"),
  storageType: text("storage_type").$type<StorageType>().notNull().default("local"),
  s3Endpoint: text("s3_endpoint"),
  s3Bucket: text("s3_bucket"),
  s3Region: text("s3_region"),
  s3AccessKey: text("s3_access_key"), // Should be encrypted
  s3SecretKey: text("s3_secret_key"), // Should be encrypted
  s3PublicUrl: text("s3_public_url"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

// Relations
export const platformConfigRelations = relations(platformConfigTable, () => ({}));

export const userConfigRelations = relations(userConfigTable, ({ one }) => ({
  user: one(userTable, {
    fields: [userConfigTable.userId],
    references: [userTable.id],
  }),
}));

export const whatsappMemberRelations = relations(
  whatsappMemberTable,
  ({ one }) => ({
    whatsapp: one(whatsappTable, {
      fields: [whatsappMemberTable.whatsappId],
      references: [whatsappTable.id],
    }),
    user: one(userTable, {
      fields: [whatsappMemberTable.userId],
      references: [userTable.id],
    }),
    createdByUser: one(userTable, {
      fields: [whatsappMemberTable.createdBy],
      references: [userTable.id],
    }),
  })
);

export const whatsappCleanupConfigRelations = relations(
  whatsappCleanupConfigTable,
  ({ one }) => ({
    whatsapp: one(whatsappTable, {
      fields: [whatsappCleanupConfigTable.whatsappId],
      references: [whatsappTable.id],
    }),
  })
);

export const chatConfigRelations = relations(chatConfigTable, ({ one }) => ({
  whatsapp: one(whatsappTable, {
    fields: [chatConfigTable.whatsappId],
    references: [whatsappTable.id],
  }),
}));

export const chatNoteRelations = relations(chatNoteTable, ({ one }) => ({
  whatsapp: one(whatsappTable, {
    fields: [chatNoteTable.whatsappId],
    references: [whatsappTable.id],
  }),
  createdByUser: one(userTable, {
    fields: [chatNoteTable.createdBy],
    references: [userTable.id],
  }),
}));

export const storageConfigRelations = relations(storageConfigTable, () => ({}));
