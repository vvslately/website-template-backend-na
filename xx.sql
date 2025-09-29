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
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `categories` (`id`, `parent_id`, `title`, `subtitle`, `image`, `category`, `featured`, `isActive`, `priority`, `created_at`) VALUES
(1, NULL, 'Roblox Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1039b6594d85d4e0c11.webp', 'RobloxHub', 1, 1, 0, '2025-09-11 14:07:37'),
(10, NULL, 'Rov Hub', '', 'https://img2.pic.in.th/pic/10535e27fa7858dfc42.webp', 'RovHub', 0, 1, 0, '2025-09-11 14:07:37'),
(11, NULL, 'Valorant Hub', '', 'https://img5.pic.in.th/file/secure-sv1/10472eb431708d334d5.webp', 'ValorantHub', 0, 1, 0, '2025-09-11 14:07:37'),
(12, 11, 'Valorant เปลี่ยนไม่ได้', '', 'https://img2.pic.in.th/pic/108d22762240704c628.webp', 'Valorant1', 0, 1, 0, '2025-09-11 14:07:37'),
(13, 11, 'Valorant เปลี่ยนได้', '', 'https://img5.pic.in.th/file/secure-sv1/109f74a767da8d8e05b.webp', 'Valorant2', 0, 1, 0, '2025-09-11 14:07:37'),
(14, NULL, 'Unban Hub', '', 'https://img2.pic.in.th/pic/1029469ce145d10b305.webp', 'UnbanHub', 0, 1, 100, '2025-09-11 14:07:37'),
(18, NULL, 'Social Hub', '', 'https://img5.pic.in.th/file/secure-sv1/1019c155c6c488f26ef.webp', 'SocialHub', 0, 1, 0, '2025-09-14 19:37:23'),
(19, NULL, 'Steam Offline', '', 'https://img2.pic.in.th/pic/107736f52f0f88aa6fd.webp', 'SteamOffline', 0, 1, 0, '2025-09-14 23:46:47'),
(20, NULL, 'Minecraft Hub', NULL, 'https://img2.pic.in.th/pic/d8421f75e13907471e802d0fdf33d2a0.webp', 'MinecraftHub', 0, 0, 0, '2025-09-16 18:50:41'),
(21, NULL, 'Program Hub', '', 'https://img2.pic.in.th/pic/111164c0a2a3238e1a3e.webp', 'programhub', 0, 1, 0, '2025-09-16 22:44:49'),
(22, NULL, 'steam มือ 2 เปลี่ยนได้', '', 'https://img2.pic.in.th/pic/107736f52f0f88aa6fd.webp', 'steam2', 0, 1, 0, '2025-09-20 17:15:53'),
(23, NULL, 'Steam เสกเกมติดเครื่อง', NULL, 'https://img2.pic.in.th/pic/107736f52f0f88aa6fd.webp', 'steam-tls', 0, 1, 0, '2025-09-28 15:35:23'),
(24, NULL, 'FiveM Hub', '', 'https://img5.pic.in.th/file/secure-sv1/Untitled-2dfeee3d510938b6a.png', 'FiveMHub', 0, 1, 0, '2025-09-29 14:45:34');


/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;