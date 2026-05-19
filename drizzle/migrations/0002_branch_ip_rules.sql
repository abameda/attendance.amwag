ALTER TABLE `branch_allowed_ips`
  ADD COLUMN `rule_type` enum('exact_ip','cidr') NOT NULL DEFAULT 'exact_ip' AFTER `branch_name`,
  ADD COLUMN `created_by` char(36) AFTER `is_active`,
  ADD COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `created_at`;
--> statement-breakpoint
CREATE INDEX `idx_branch_allowed_ips_branch` ON `branch_allowed_ips` (`branch_name`);--> statement-breakpoint
CREATE INDEX `idx_branch_allowed_ips_active` ON `branch_allowed_ips` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_branch_allowed_ips_rule_type` ON `branch_allowed_ips` (`rule_type`);
