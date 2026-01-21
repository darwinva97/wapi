import { relations } from "drizzle-orm";
import { pgTable, text, boolean, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core";
import { userTable } from "./user";
import { whatsappTable } from "./whatsapp";

// Instance role enum type
export type WhatsappMemberRole = "owner" | "manager" | "agent";

// Storage type enum
export type StorageType = "local" | "s3";

// Platform configuration (singleton)
export const platformConfigTable = pgTable("platform_config", {
  id: text("id").primaryKey().default("default"),
  allowRegistration: boolean("allow_registration")
    .notNull()
    .default(false),
  allowUserCreateWhatsapp: boolean("allow_user_create_whatsapp")
    .notNull()
    .default(true),
  defaultMaxWhatsappInstances: integer("default_max_whatsapp_instances")
    .notNull()
    .default(0), // 0 = unlimited
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// User-specific configuration overrides
export const userConfigTable = pgTable(
  "user_config",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => userTable.id, { onDelete: "cascade" }),
    canCreateWhatsapp: boolean("can_create_whatsapp"), // null = use global
    maxWhatsappInstances: integer("max_whatsapp_instances"), // null = use global
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_config_userId_idx").on(table.userId)]
);

// WhatsApp instance members (roles: owner, manager, agent)
export const whatsappMemberTable = pgTable(
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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
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
export const whatsappCleanupConfigTable = pgTable(
  "whatsapp_cleanup_config",
  {
    whatsappId: text("whatsapp_id")
      .primaryKey()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    cleanupEnabled: boolean("cleanup_enabled")
      .notNull()
      .default(false),
    cleanupDays: integer("cleanup_days").notNull().default(30),
    excludeChats: jsonb("exclude_chats")
      .$type<string[]>()
      .default([]),
    includeOnlyChats: jsonb("include_only_chats")
      .$type<string[]>()
      .default([]),
    forceCleanup: boolean("force_cleanup")
      .notNull()
      .default(false),
    maxAgentRetentionDays: integer("max_agent_retention_days")
      .notNull()
      .default(90),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

// Chat-specific configuration
export const chatConfigTable = pgTable(
  "chat_config",
  {
    id: text("id").primaryKey(),
    whatsappId: text("whatsapp_id")
      .notNull()
      .references(() => whatsappTable.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    customName: text("custom_name"),
    cleanupExcluded: boolean("cleanup_excluded")
      .notNull()
      .default(false),
    cleanupIncluded: boolean("cleanup_included")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_config_whatsappId_idx").on(table.whatsappId),
    index("chat_config_whatsappId_chatId_idx").on(table.whatsappId, table.chatId),
  ]
);

// Chat notes
export const chatNoteTable = pgTable(
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
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("chat_note_whatsappId_idx").on(table.whatsappId),
    index("chat_note_whatsappId_chatId_idx").on(table.whatsappId, table.chatId),
  ]
);

// Storage configuration (singleton)
export const storageConfigTable = pgTable("storage_config", {
  id: text("id").primaryKey().default("default"),
  storageType: text("storage_type").$type<StorageType>().notNull().default("local"),
  s3Endpoint: text("s3_endpoint"),
  s3Bucket: text("s3_bucket"),
  s3Region: text("s3_region"),
  s3AccessKey: text("s3_access_key"), // Should be encrypted
  s3SecretKey: text("s3_secret_key"), // Should be encrypted
  s3PublicUrl: text("s3_public_url"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
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
