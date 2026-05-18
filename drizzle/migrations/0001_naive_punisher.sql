ALTER TABLE `users` MODIFY COLUMN `must_change_password` tinyint NOT NULL DEFAULT 0;
UPDATE `users` SET `must_change_password` = 0 WHERE `must_change_password` = 1;