CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`robot_id` text NOT NULL,
	`message` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_robot_idx` ON `events` (`robot_id`);--> statement-breakpoint
CREATE INDEX `events_created_idx` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE TABLE `robots` (
	`id` text PRIMARY KEY NOT NULL,
	`numeric_id` text NOT NULL,
	`color` text NOT NULL,
	`battery` integer DEFAULT 100 NOT NULL,
	`status` text DEFAULT 'IDLE' NOT NULL,
	`position_x` real DEFAULT 0 NOT NULL,
	`position_z` real DEFAULT 0 NOT NULL,
	`target_x` real DEFAULT 0 NOT NULL,
	`target_z` real DEFAULT 0 NOT NULL,
	`speed` real DEFAULT 0 NOT NULL,
	`distance_travelled` real DEFAULT 0 NOT NULL,
	`payload` text,
	`current_task` text,
	`destination` text DEFAULT 'IDLE' NOT NULL,
	`is_emergency_stopped` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `robots_status_idx` ON `robots` (`status`);--> statement-breakpoint
CREATE INDEX `robots_updated_idx` ON `robots` (`updated_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`box_id` text NOT NULL,
	`pickup_node` text NOT NULL,
	`drop_location` text NOT NULL,
	`assigned_robot_id` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_robot_idx` ON `tasks` (`assigned_robot_id`);--> statement-breakpoint
CREATE INDEX `tasks_created_idx` ON `tasks` (`created_at`);