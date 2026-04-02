SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `jeton` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `pack_name` varchar(120) NOT NULL,
  `tokens` int NOT NULL,
  `price_tnd` decimal(10,2) NOT NULL,
  `contact_info` varchar(190) DEFAULT NULL,
  `request_source` enum('pack','custom') NOT NULL DEFAULT 'pack',
  `status` enum('pending','payment_pending','payment_submitted','approved','rejected') NOT NULL DEFAULT 'pending',
  `payment_proof` longblob,
  `payment_proof_mime` varchar(120) DEFAULT NULL,
  `payment_proof_name` varchar(255) DEFAULT NULL,
  `payment_uploaded_at` datetime DEFAULT NULL,
  `admin_note` varchar(500) DEFAULT NULL,
  `decided_by` int DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `matricule_fiscale` varchar(100) NOT NULL,
  `adresse` varchar(255) NOT NULL,
  `ville` varchar(100) NOT NULL,
  `code_postal` varchar(20) NOT NULL,
  `telephone` varchar(50) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `fax` varchar(50) DEFAULT NULL,
  `owner_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `organization_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `invited_user_id` int NOT NULL,
  `invited_email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `status` enum('pending','accepted','rejected','expired') DEFAULT 'pending',
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `accepted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `organization_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('OWNER','MEMBER') DEFAULT 'MEMBER',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_member` (`organization_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `facture_number` varchar(255) NOT NULL,
  `signataire_email` varchar(255) NOT NULL,
  `client_email` varchar(255) NOT NULL,
  `user_id` int NOT NULL,
  `statut` varchar(50) DEFAULT 'créé',
  `date_creation` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `signed_at` datetime DEFAULT NULL,
  `position` json DEFAULT NULL,
  `qr_config` json DEFAULT NULL,
  `ref_config` json DEFAULT NULL,
  `date_suppression` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `transaction_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` int NOT NULL,
  `pdf_file` longtext,
  `xml_file` longtext,
  `xml_signed` longtext,
  `filename` varchar(255) NOT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `statut` varchar(50) DEFAULT 'créé',
  `signed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `xml_signed_ttn` longtext,
  `ttn_reference` text,
  `ttn_id_save` text,
  `signed_ttn_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMIN','USER') DEFAULT 'USER',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `phone` varchar(30) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `email_verification_code` varchar(10) DEFAULT NULL,
  `email_verification_expires` datetime DEFAULT NULL,
  `reset_code` varchar(10) DEFAULT NULL,
  `reset_expires` datetime DEFAULT NULL,
  `statut` tinyint(1) NOT NULL DEFAULT '1',
  `api_token` varchar(255) DEFAULT NULL,
  `total_jetons` int NOT NULL DEFAULT '0',
  `matricule_fiscale` varchar(100) DEFAULT NULL,
  `ville` varchar(100) DEFAULT NULL,
  `code_postal` varchar(20) DEFAULT NULL,
  `ttn_login` varchar(100) DEFAULT NULL,
  `ttn_password` varchar(255) DEFAULT NULL,
  `certified` tinyint(1) DEFAULT '0',
  `adresse` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

COMMIT;
