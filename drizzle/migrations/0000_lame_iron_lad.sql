CREATE TABLE `attendance` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`date` date NOT NULL,
	`check_in_time` datetime(3),
	`check_out_time` datetime(3),
	`ip_address` varchar(45),
	`check_out_ip` varchar(45),
	`check_in_location` text,
	`check_out_location` text,
	`status` enum('present','late','absent','missing_checkout') NOT NULL DEFAULT 'present',
	`late_minutes` int NOT NULL DEFAULT 0,
	`early_departure_minutes` int NOT NULL DEFAULT 0,
	`overtime_minutes` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_user_date` UNIQUE(`user_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `branch_allowed_ips` (
	`id` char(36) NOT NULL,
	`branch_name` varchar(255) NOT NULL,
	`ip_network` varchar(45) NOT NULL,
	`description` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `branch_allowed_ips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `global_settings` (
	`id` tinyint NOT NULL DEFAULT 1,
	`early_checkin_minutes` int NOT NULL DEFAULT 60,
	`late_grace_minutes` int NOT NULL DEFAULT 0,
	`checkout_window_minutes` int NOT NULL DEFAULT 60,
	`max_overtime_minutes` int NOT NULL DEFAULT 180,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `global_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	`user_agent` varchar(500),
	`ip_address` varchar(45),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(72) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('admin','accountant','employee') NOT NULL DEFAULT 'employee',
	`branch` varchar(255),
	`job_title` varchar(255),
	`shift_start` time,
	`shift_end` time,
	`off_day` varchar(20),
	`overtime_enabled` tinyint NOT NULL DEFAULT 1,
	`must_change_password` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_user_id` ON `attendance` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_date` ON `attendance` (`date`);--> statement-breakpoint
CREATE INDEX `idx_attendance_user_date_status` ON `attendance` (`user_id`,`date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_branch_allowed_ips_network` ON `branch_allowed_ips` (`ip_network`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_branch` ON `users` (`branch`);--> statement-breakpoint
INSERT INTO `global_settings` (`id`) VALUES (1);
