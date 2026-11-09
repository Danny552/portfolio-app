/*
  Warnings:

  - You are about to drop the `Ping` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `Ping`;

-- CreateTable
CREATE TABLE `Portfolio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `origin` ENUM('ORIGINAL', 'PURCHASED', 'INHERITED') NOT NULL,
    `source` VARCHAR(191) NULL,
    `acquiredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EconomicActivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `EconomicActivity_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `portfolioId` INTEGER NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `documentType` ENUM('CC', 'CE', 'NIT', 'PASSPORT', 'TI', 'PEP', 'OTHER') NOT NULL,
    `documentNumber` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `profession` VARCHAR(191) NULL,
    `occupationType` ENUM('EMPLOYEE', 'SELF_EMPLOYED') NULL,
    `jobTitle` VARCHAR(191) NULL,
    `economicActivityId` INTEGER NULL,
    `yearsExperience` INTEGER NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'COMMON_LAW', 'DIVORCED', 'WIDOWED') NULL,
    `dependents` INTEGER NOT NULL DEFAULT 0,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `importBatchId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Client_portfolioId_idx`(`portfolioId`),
    UNIQUE INDEX `Client_documentType_documentNumber_key`(`documentType`, `documentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Income` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `type` ENUM('FIXED', 'ADDITIONAL') NOT NULL,
    `description` VARCHAR(191) NULL,
    `monthlyAmount` DECIMAL(18, 2) NOT NULL,
    `source` ENUM('CLIENT', 'ADMIN', 'IMPORT', 'BUREAU') NOT NULL DEFAULT 'CLIENT',
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Income_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `value` DECIMAL(18, 2) NOT NULL,
    `asOfDate` DATETIME(3) NULL,
    `source` ENUM('CLIENT', 'ADMIN', 'IMPORT', 'BUREAU') NOT NULL DEFAULT 'CLIENT',
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Asset_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `monthlyAmount` DECIMAL(18, 2) NOT NULL,
    `source` ENUM('CLIENT', 'ADMIN', 'IMPORT', 'BUREAU') NOT NULL DEFAULT 'CLIENT',
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Expense_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `accountType` VARCHAR(191) NOT NULL,
    `creditLimit` DECIMAL(18, 2) NULL,
    `balance` DECIMAL(18, 2) NOT NULL,
    `monthlyPayment` DECIMAL(18, 2) NULL,
    `status` VARCHAR(191) NULL,
    `reportDate` DATETIME(3) NULL,
    `source` ENUM('CLIENT', 'ADMIN', 'IMPORT', 'BUREAU') NOT NULL DEFAULT 'BUREAU',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreditAccount_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `Consent_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'DATA_MANAGER', 'CLIENT') NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportBatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(191) NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_portfolioId_fkey` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_economicActivityId_fkey` FOREIGN KEY (`economicActivityId`) REFERENCES `EconomicActivity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Income` ADD CONSTRAINT `Income_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportBatch` ADD CONSTRAINT `ImportBatch_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
