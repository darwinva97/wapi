CREATE TABLE `chat_config` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`custom_name` text,
	`cleanup_excluded` integer DEFAULT false NOT NULL,
	`cleanup_included` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_config_whatsappId_idx` ON `chat_config` (`whatsapp_id`);--> statement-breakpoint
CREATE INDEX `chat_config_whatsappId_chatId_idx` ON `chat_config` (`whatsapp_id`,`chat_id`);--> statement-breakpoint
CREATE TABLE `chat_note` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_note_whatsappId_idx` ON `chat_note` (`whatsapp_id`);--> statement-breakpoint
CREATE INDEX `chat_note_whatsappId_chatId_idx` ON `chat_note` (`whatsapp_id`,`chat_id`);--> statement-breakpoint
CREATE TABLE `platform_config` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`allow_registration` integer DEFAULT false NOT NULL,
	`allow_user_create_whatsapp` integer DEFAULT true NOT NULL,
	`default_max_whatsapp_instances` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `storage_config` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`storage_type` text DEFAULT 'local' NOT NULL,
	`s3_endpoint` text,
	`s3_bucket` text,
	`s3_region` text,
	`s3_access_key` text,
	`s3_secret_key` text,
	`s3_public_url` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`can_create_whatsapp` integer,
	`max_whatsapp_instances` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_config_user_id_unique` ON `user_config` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_config_userId_idx` ON `user_config` (`user_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_cleanup_config` (
	`whatsapp_id` text PRIMARY KEY NOT NULL,
	`cleanup_enabled` integer DEFAULT false NOT NULL,
	`cleanup_days` integer DEFAULT 30 NOT NULL,
	`exclude_chats` text DEFAULT '[]',
	`include_only_chats` text DEFAULT '[]',
	`force_cleanup` integer DEFAULT false NOT NULL,
	`max_agent_retention_days` integer DEFAULT 90 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `whatsapp_member` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_by` text,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `whatsapp_member_whatsappId_idx` ON `whatsapp_member` (`whatsapp_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_member_userId_idx` ON `whatsapp_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_member_whatsappId_userId_idx` ON `whatsapp_member` (`whatsapp_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `connection` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`receiver_enabled` integer NOT NULL,
	`receiver_request` text,
	`receiver_filter` text,
	`sender_enabled` integer NOT NULL,
	`sender_token` text,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connection_slug_unique` ON `connection` (`slug`);--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`name` text NOT NULL,
	`push_name` text NOT NULL,
	`lid` text NOT NULL,
	`pn` text NOT NULL,
	`description` text,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `group` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`name` text NOT NULL,
	`push_name` text NOT NULL,
	`gid` text NOT NULL,
	`description` text,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`chat_type` text NOT NULL,
	`sender_id` text NOT NULL,
	`content` text,
	`body` text,
	`timestamp` integer NOT NULL,
	`from_me` integer NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`media_url` text,
	`media_metadata` text,
	`ack_status` integer DEFAULT 0 NOT NULL,
	`file_name` text,
	`media_retention_until` integer,
	`media_retention_set_by` text,
	`sent_from_platform` integer DEFAULT false,
	`sent_by_user_id` text,
	`sent_by_connection_id` text,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_retention_set_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sent_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sent_by_connection_id`) REFERENCES `connection`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `poll` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`message_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`allow_multiple_answers` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_vote` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`poll_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`selected_options` text NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_id`) REFERENCES `poll`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reaction` (
	`id` text PRIMARY KEY NOT NULL,
	`whatsapp_id` text NOT NULL,
	`message_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`emoji` text NOT NULL,
	`timestamp` integer NOT NULL,
	`from_me` integer NOT NULL,
	FOREIGN KEY (`whatsapp_id`) REFERENCES `whatsapp`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `whatsapp` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`phone_number` text NOT NULL,
	`connected` integer NOT NULL,
	`enabled` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_slug_unique` ON `whatsapp` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_phone_number_unique` ON `whatsapp` (`phone_number`);