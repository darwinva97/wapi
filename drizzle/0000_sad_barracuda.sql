CREATE TABLE "chat_config" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"custom_name" text,
	"cleanup_excluded" boolean DEFAULT false NOT NULL,
	"cleanup_included" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_note" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"allow_registration" boolean DEFAULT false NOT NULL,
	"allow_user_create_whatsapp" boolean DEFAULT true NOT NULL,
	"default_max_whatsapp_instances" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"storage_type" text DEFAULT 'local' NOT NULL,
	"s3_endpoint" text,
	"s3_bucket" text,
	"s3_region" text,
	"s3_access_key" text,
	"s3_secret_key" text,
	"s3_public_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_config" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"can_create_whatsapp" boolean,
	"max_whatsapp_instances" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_cleanup_config" (
	"whatsapp_id" text PRIMARY KEY NOT NULL,
	"cleanup_enabled" boolean DEFAULT false NOT NULL,
	"cleanup_days" integer DEFAULT 30 NOT NULL,
	"exclude_chats" jsonb DEFAULT '[]'::jsonb,
	"include_only_chats" jsonb DEFAULT '[]'::jsonb,
	"force_cleanup" boolean DEFAULT false NOT NULL,
	"max_agent_retention_days" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_member" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"receiver_enabled" boolean NOT NULL,
	"receiver_request" jsonb,
	"receiver_filter" jsonb,
	"sender_enabled" boolean NOT NULL,
	"sender_token" text,
	CONSTRAINT "connection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"name" text NOT NULL,
	"push_name" text NOT NULL,
	"lid" text NOT NULL,
	"pn" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "group" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"name" text NOT NULL,
	"push_name" text NOT NULL,
	"gid" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"chat_type" text NOT NULL,
	"sender_id" text NOT NULL,
	"content" jsonb,
	"body" text,
	"timestamp" timestamp with time zone NOT NULL,
	"from_me" boolean NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"media_url" text,
	"media_metadata" jsonb,
	"ack_status" integer DEFAULT 0 NOT NULL,
	"file_name" text,
	"media_retention_until" timestamp with time zone,
	"media_retention_set_by" text,
	"sent_from_platform" boolean DEFAULT false,
	"sent_by_user_id" text,
	"sent_by_connection_id" text
);
--> statement-breakpoint
CREATE TABLE "poll" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"message_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"allow_multiple_answers" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_vote" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"poll_id" text NOT NULL,
	"voter_id" text NOT NULL,
	"selected_options" jsonb NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_id" text NOT NULL,
	"message_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"emoji" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"from_me" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"phone_number" text NOT NULL,
	"connected" boolean NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "whatsapp_slug_unique" UNIQUE("slug"),
	CONSTRAINT "whatsapp_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
ALTER TABLE "chat_config" ADD CONSTRAINT "chat_config_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_note" ADD CONSTRAINT "chat_note_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_note" ADD CONSTRAINT "chat_note_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_config" ADD CONSTRAINT "user_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_cleanup_config" ADD CONSTRAINT "whatsapp_cleanup_config_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_member" ADD CONSTRAINT "whatsapp_member_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_member" ADD CONSTRAINT "whatsapp_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_member" ADD CONSTRAINT "whatsapp_member_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_media_retention_set_by_user_id_fk" FOREIGN KEY ("media_retention_set_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sent_by_user_id_user_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sent_by_connection_id_connection_id_fk" FOREIGN KEY ("sent_by_connection_id") REFERENCES "public"."connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll" ADD CONSTRAINT "poll_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_vote" ADD CONSTRAINT "poll_vote_poll_id_poll_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."poll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_whatsapp_id_whatsapp_id_fk" FOREIGN KEY ("whatsapp_id") REFERENCES "public"."whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp" ADD CONSTRAINT "whatsapp_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_config_whatsappId_idx" ON "chat_config" USING btree ("whatsapp_id");--> statement-breakpoint
CREATE INDEX "chat_config_whatsappId_chatId_idx" ON "chat_config" USING btree ("whatsapp_id","chat_id");--> statement-breakpoint
CREATE INDEX "chat_note_whatsappId_idx" ON "chat_note" USING btree ("whatsapp_id");--> statement-breakpoint
CREATE INDEX "chat_note_whatsappId_chatId_idx" ON "chat_note" USING btree ("whatsapp_id","chat_id");--> statement-breakpoint
CREATE INDEX "user_config_userId_idx" ON "user_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_member_whatsappId_idx" ON "whatsapp_member" USING btree ("whatsapp_id");--> statement-breakpoint
CREATE INDEX "whatsapp_member_userId_idx" ON "whatsapp_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "whatsapp_member_whatsappId_userId_idx" ON "whatsapp_member" USING btree ("whatsapp_id","user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");