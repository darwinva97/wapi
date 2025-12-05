import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { userTable } from "./user";

export const whatsappTable = sqliteTable("whatsapp", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  phoneNumber: text("phone_number").notNull().unique(),
  connected: integer("connected", { mode: 'boolean' }).notNull(),
  enabled: integer("enabled", { mode: 'boolean' }).notNull(),
});

export const contactTable = sqliteTable("contact", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pushName: text("push_name").notNull(),
  lid: text("lid").notNull(),
  pn: text("pn").notNull(),
  description: text("description"),
});

export const groupTable = sqliteTable("group", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pushName: text("push_name").notNull(),
  gid: text("gid").notNull(),
  description: text("description"),
});

export const connectionTable = sqliteTable("connection", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  //
  receiverEnabled: integer("receiver_enabled", { mode: 'boolean' }).notNull(),
  receiverRequest: text("receiver_request", { mode: 'json' }),
  receiverFilter: text("receiver_filter", { mode: 'json' }),
  //
  senderEnabled: integer("sender_enabled", { mode: 'boolean' }).notNull(),
  senderToken: text("sender_token"),
});

export const messageTable = sqliteTable("message", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  chatType: text("chat_type").notNull(), // 'group' | 'personal'
  senderId: text("sender_id").notNull(),
  content: text("content", { mode: 'json' }),
  body: text("body"),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
  fromMe: integer("from_me", { mode: 'boolean' }).notNull(),
});
