CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_user_idx` ON `projects` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`expires_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`reminder_at` text,
	`reminder_sent_at` text,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`subtasks_json` text DEFAULT '[]' NOT NULL,
	`estimate_minutes` integer,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_user_updated_idx` ON `tasks` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tasks_user_due_idx` ON `tasks` (`user_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_reminder_idx` ON `tasks` (`reminder_at`,`reminder_sent_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_id` text NOT NULL,
	`display_name` text NOT NULL,
	`username` text,
	`language_code` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_id_idx` ON `users` (`telegram_id`);