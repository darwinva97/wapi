import { pgTable, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { userTable } from "./user";

export const whatsappTable = pgTable("whatsapp", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  phoneNumber: text("phone_number").notNull().unique(),
  connected: boolean("connected").notNull(),
  enabled: boolean("enabled").notNull(),
});

export const contactTable = pgTable("contact", {
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

export const groupTable = pgTable("group", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pushName: text("push_name").notNull(),
  gid: text("gid").notNull(),
  description: text("description"),
});

export const connectionTable = pgTable("connection", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  //
  receiverEnabled: boolean("receiver_enabled").notNull(),
  receiverRequest: jsonb("receiver_request"),
  receiverFilter: jsonb("receiver_filter"),
  //
  senderEnabled: boolean("sender_enabled").notNull(),
  senderToken: text("sender_token"),
});

export const messageTable = pgTable("message", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  chatType: text("chat_type").notNull(), // 'group' | 'personal'
  senderId: text("sender_id").notNull(),
  content: jsonb("content"),
  body: text("body"),
  timestamp: timestamp("timestamp", { mode: "date", withTimezone: true }).notNull(),
  fromMe: boolean("from_me").notNull(),
  // Media and tracking fields
  messageType: text("message_type").notNull().default('text'), // 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document'
  mediaUrl: text("media_url"), // Public path to media file
  mediaMetadata: jsonb("media_metadata"), // { mimetype, size, duration, width, height, fileName, sha256 }
  ackStatus: integer("ack_status").notNull().default(0), // 0=pending, 1=sent, 2=delivered, 3=read
  fileName: text("file_name"), // Original filename for documents
  // Media retention fields
  mediaRetentionUntil: timestamp("media_retention_until", { mode: "date", withTimezone: true }), // Retain media until this date (null = use global policy)
  mediaRetentionSetBy: text("media_retention_set_by")
    .references(() => userTable.id, { onDelete: "set null" }), // User who configured the retention
  // Message origin tracking fields
  sentFromPlatform: boolean("sent_from_platform").default(false), // Was sent from WAPI platform
  sentByUserId: text("sent_by_user_id")
    .references(() => userTable.id, { onDelete: "set null" }), // User who sent from platform
  sentByConnectionId: text("sent_by_connection_id")
    .references(() => connectionTable.id, { onDelete: "set null" }), // Connection that sent via API
});

export const reactionTable = pgTable("reaction", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  messageId: text("message_id")
    .notNull()
    .references(() => messageTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  senderId: text("sender_id").notNull(), // Who reacted
  emoji: text("emoji").notNull(), // The reaction emoji
  timestamp: timestamp("timestamp", { mode: "date", withTimezone: true }).notNull(),
  fromMe: boolean("from_me").notNull(),
});

export const pollTable = pgTable("poll", {
  id: text("id").primaryKey(), // Poll message ID
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  messageId: text("message_id")
    .notNull()
    .references(() => messageTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").notNull(), // Array of poll options
  allowMultipleAnswers: boolean("allow_multiple_answers").notNull().default(false),
  createdBy: text("created_by").notNull(),
  timestamp: timestamp("timestamp", { mode: "date", withTimezone: true }).notNull(),
});

export const pollVoteTable = pgTable("poll_vote", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id")
    .notNull()
    .references(() => whatsappTable.id, { onDelete: "cascade" }),
  pollId: text("poll_id")
    .notNull()
    .references(() => pollTable.id, { onDelete: "cascade" }),
  voterId: text("voter_id").notNull(), // Who voted
  selectedOptions: jsonb("selected_options").notNull(), // Array of selected option indices
  timestamp: timestamp("timestamp", { mode: "date", withTimezone: true }).notNull(),
});
