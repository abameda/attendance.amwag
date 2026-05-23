CREATE TABLE `branches` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(64) NOT NULL,
	`address` text,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uk_branches_name` UNIQUE(`name`),
	CONSTRAINT `uk_branches_code` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `branch_id` char(36) AFTER `branch`;--> statement-breakpoint
ALTER TABLE `branch_allowed_ips` ADD COLUMN `branch_id` char(36) AFTER `branch_name`;--> statement-breakpoint
INSERT INTO `branches` (`id`, `name`, `code`)
SELECT UUID(), source.`branch_name`, CONCAT('BR-', SUBSTRING(SHA2(source.`branch_name`, 256), 1, 12))
FROM (
	SELECT DISTINCT TRIM(`branch`) AS `branch_name` FROM `users` WHERE `branch` IS NOT NULL AND TRIM(`branch`) <> ''
	UNION
	SELECT DISTINCT TRIM(`branch_name`) AS `branch_name` FROM `branch_allowed_ips` WHERE `branch_name` IS NOT NULL AND TRIM(`branch_name`) <> ''
	UNION SELECT 'ملوي'
	UNION SELECT 'الأضافيه'
	UNION SELECT 'شلبي'
	UNION SELECT 'بني مزار'
	UNION SELECT 'الجيزه'
	UNION SELECT 'رمسيس'
	UNION SELECT 'محرم بك'
	UNION SELECT 'شرم الشيخ'
	UNION SELECT 'الغردقه'
	UNION SELECT 'IT Department'
) source
LEFT JOIN `branches` existing ON existing.`name` = source.`branch_name`
WHERE source.`branch_name` IS NOT NULL
	AND source.`branch_name` <> ''
	AND existing.`id` IS NULL;
--> statement-breakpoint
UPDATE `users` user_rows
JOIN `branches` branch_rows ON branch_rows.`name` = TRIM(user_rows.`branch`)
SET user_rows.`branch_id` = branch_rows.`id`
WHERE user_rows.`branch` IS NOT NULL
	AND TRIM(user_rows.`branch`) <> ''
	AND user_rows.`branch_id` IS NULL;
--> statement-breakpoint
UPDATE `branch_allowed_ips` ip_rows
JOIN `branches` branch_rows ON branch_rows.`name` = TRIM(ip_rows.`branch_name`)
SET ip_rows.`branch_id` = branch_rows.`id`
WHERE ip_rows.`branch_name` IS NOT NULL
	AND TRIM(ip_rows.`branch_name`) <> ''
	AND ip_rows.`branch_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_branches_active` ON `branches` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_users_branch_id` ON `users` (`branch_id`);--> statement-breakpoint
CREATE INDEX `idx_branch_allowed_ips_branch_id` ON `branch_allowed_ips` (`branch_id`);
