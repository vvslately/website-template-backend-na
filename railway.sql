/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_id` int DEFAULT NULL,
  `title` varchar(150) NOT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `featured` tinyint(1) DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `priority` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `category` (`category`),
  KEY `idx_parent_id` (`parent_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `config`;
CREATE TABLE `config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_phone` varchar(20) NOT NULL,
  `site_name` varchar(100) DEFAULT NULL,
  `site_logo` varchar(255) DEFAULT NULL,
  `meta_title` varchar(255) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `meta_keywords` varchar(500) DEFAULT NULL,
  `meta_author` varchar(100) DEFAULT NULL,
  `discord_link` varchar(255) DEFAULT NULL,
  `discord_webhook` varchar(255) DEFAULT NULL,
  `banner_link` varchar(255) DEFAULT NULL,
  `banner2_link` varchar(255) DEFAULT NULL,
  `banner3_link` varchar(255) DEFAULT NULL,
  `background_image` varchar(255) DEFAULT NULL,
  `footer_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `product_stock`;
CREATE TABLE `product_stock` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `license_key` varchar(255) NOT NULL,
  `sold` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `title` varchar(150) NOT NULL,
  `subtitle` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `reseller_price` decimal(10,2) DEFAULT NULL,
  `stock` int DEFAULT '0',
  `duration` varchar(50) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `download_link` varchar(1000) DEFAULT NULL,
  `isSpecial` tinyint(1) DEFAULT '0',
  `featured` tinyint(1) DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `isWarrenty` tinyint(1) DEFAULT '0',
  `warrenty_text` varchar(1000) DEFAULT NULL,
  `primary_color` char(7) DEFAULT NULL,
  `secondary_color` char(7) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `priority` int NOT NULL DEFAULT '0',
  `discount_percent` tinyint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  CONSTRAINT `products_chk_1` CHECK ((`discount_percent` between 0 and 100))
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rank_name` varchar(100) NOT NULL,
  `can_edit_categories` tinyint(1) DEFAULT '0',
  `can_edit_products` tinyint(1) DEFAULT '0',
  `can_edit_users` tinyint(1) DEFAULT '0',
  `can_edit_orders` tinyint(1) DEFAULT '0',
  `can_manage_keys` tinyint(1) DEFAULT '0',
  `can_view_reports` tinyint(1) DEFAULT '0',
  `can_manage_promotions` tinyint(1) DEFAULT '0',
  `can_manage_settings` tinyint(1) DEFAULT '0',
  `can_access_reseller_price` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `theme_settings`;
CREATE TABLE `theme_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `primary_color` varchar(7) NOT NULL,
  `secondary_color` varchar(7) NOT NULL,
  `background_color` varchar(7) NOT NULL,
  `text_color` varchar(7) NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `topups`;
CREATE TABLE `topups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `method` varchar(50) NOT NULL,
  `transaction_ref` varchar(100) DEFAULT NULL,
  `status` enum('pending','success','failed') DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_topups_user_id` (`user_id`),
  CONSTRAINT `topups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `transaction_items`;
CREATE TABLE `transaction_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bill_number` varchar(50) NOT NULL,
  `transaction_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `license_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_transaction_items_transaction_id` (`transaction_id`),
  KEY `idx_transaction_items_product_id` (`product_id`),
  KEY `transaction_items_ibfk_3` (`license_id`),
  CONSTRAINT `transaction_items_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_items_ibfk_3` FOREIGN KEY (`license_id`) REFERENCES `product_stock` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bill_number` varchar(50) NOT NULL,
  `user_id` int NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_transactions_user_id` (`user_id`),
  KEY `idx_transactions_created_at` (`created_at`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `discord_id` varchar(50) DEFAULT NULL,
  `fullname` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `money` decimal(10,2) DEFAULT '0.00',
  `points` int DEFAULT '0',
  `role` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'member',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `categories` (`id`, `parent_id`, `title`, `subtitle`, `image`, `category`, `featured`, `isActive`, `priority`, `created_at`) VALUES
(1, NULL, 'Roblox Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1640x500.jpg', 'RobloxHub', 1, 1, 0, '2025-09-29 15:26:03'),
(2, NULL, 'Rov Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1640x500.jpg', 'RovHub', 0, 1, 0, '2025-09-29 15:26:03'),
(3, NULL, 'Valorant Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1640x500.jpg', 'ValorantHub', 0, 1, 0, '2025-09-29 15:26:03'),
(4, 3, 'Free Fire Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1640x500.jpg', 'FreeFire', 0, 1, 0, '2025-09-29 15:26:03');
INSERT INTO `config` (`id`, `owner_phone`, `site_name`, `site_logo`, `meta_title`, `meta_description`, `meta_keywords`, `meta_author`, `discord_link`, `discord_webhook`, `banner_link`, `banner2_link`, `banner3_link`, `background_image`, `footer_image`, `created_at`, `updated_at`) VALUES
(1, '0812345678', 'XXX', 'https://www.getampx.com/images/logo/amparexlogowithname.png', 'XXX - Template', 'ร้านขายโค้ด เกม และสินค้า Digital แท้ ปลอดภัย 100%', 'เกม, โค้ดแท้, steam, ps5, xbox, digital store', 'XXX - ประกาศ', 'https://discord.gg/abcd1234', 'https://discord.gg/abcd1234', 'https://img2.pic.in.th/pic/2000x5009e8abd4c1b6fc6df.jpg', 'https://img2.pic.in.th/pic/2000x5009e8abd4c1b6fc6df.jpg', 'https://img2.pic.in.th/pic/2000x5009e8abd4c1b6fc6df.jpg', 'https://cdn.shopify.com/s/files/1/0515/2702/4839/files/COUGH_SYRUP_BANNER.jpg?v=1729558083https://cdn.shopify.com/s/files/1/0515/2702/4839/files/COUGH_SYRUP_BANNER.jpg?v=1729558083', 'https://cdn.shopify.com/s/files/1/0515/2702/4839/files/COUGH_SYRUP_BANNER.jpg?v=1729558083', '2025-09-29 13:28:13', '2025-09-29 20:30:39');
INSERT INTO `product_stock` (`id`, `product_id`, `license_key`, `sold`, `created_at`) VALUES
(1, 1, 'abc', 1, '2025-09-29 18:11:28');
INSERT INTO `products` (`id`, `category_id`, `title`, `subtitle`, `price`, `reseller_price`, `stock`, `duration`, `image`, `download_link`, `isSpecial`, `featured`, `isActive`, `isWarrenty`, `warrenty_text`, `primary_color`, `secondary_color`, `created_at`, `priority`, `discount_percent`) VALUES
(1, 1, 'สินค้าตัวอย่าง', 'ทดสอบ', '150.00', '75.00', 0, 'ถาวร', 'https://img2.pic.in.th/pic/1500x1500.jpg', '', 1, 0, 1, 1, 'มีประกันถาวร', '#11ff00', '', '2025-09-11 14:07:32', 0, 0);

INSERT INTO `theme_settings` (`id`, `primary_color`, `secondary_color`, `background_color`, `text_color`, `updated_at`) VALUES
(1, '#00fc43', '#b3ffc7', '#f9fafb', '#111827', '2025-09-29 20:20:25');

INSERT INTO `transaction_items` (`id`, `bill_number`, `transaction_id`, `product_id`, `quantity`, `price`, `created_at`, `license_id`) VALUES
(1, 'BILL-1759169501918-A31F5IXT2', 1, 1, 1, '150.00', '2025-09-29 18:11:41', 1),
(2, 'BILL-1759171046900-IEELHH5CJ', 2, 1, 1, '150.00', '2025-09-29 18:37:26', 1);
INSERT INTO `transactions` (`id`, `bill_number`, `user_id`, `total_price`, `created_at`, `updated_at`) VALUES
(1, 'BILL-1759169501918-A31F5IXT2', 1, '150.00', '2025-09-29 18:11:41', '2025-09-29 18:11:41'),
(2, 'BILL-1759171046900-IEELHH5CJ', 1, '150.00', '2025-09-29 18:37:26', '2025-09-29 18:37:26');
INSERT INTO `users` (`id`, `discord_id`, `fullname`, `email`, `password`, `money`, `points`, `role`, `created_at`) VALUES
(1, NULL, 'teerachot nuengsonri', 'Teerachat20005@gmail.com', '$2b$10$aILjX3WITHyrXcRTb.IrLe4F/sOteD79ILWspdcWe8KPYFCYEcofC', '150.00', 0, 'member', '2025-09-29 16:23:29');


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;