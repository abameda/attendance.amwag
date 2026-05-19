CREATE INDEX `idx_attendance_status_date` ON `attendance` (`status`,`date`);--> statement-breakpoint
CREATE INDEX `idx_attendance_date_check_in` ON `attendance` (`date`,`check_in_time`);