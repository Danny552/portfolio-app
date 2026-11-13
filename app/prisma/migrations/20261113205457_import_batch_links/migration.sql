-- AlterTable
ALTER TABLE `Asset` ADD COLUMN `importBatchId` INTEGER NULL;

-- AlterTable
ALTER TABLE `CreditAccount` ADD COLUMN `importBatchId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Expense` ADD COLUMN `importBatchId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ImportBatch` ADD COLUMN `portfolioId` INTEGER NULL,
    ADD COLUMN `summary` JSON NULL;

-- AlterTable
ALTER TABLE `Income` ADD COLUMN `importBatchId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Asset_importBatchId_idx` ON `Asset`(`importBatchId`);

-- CreateIndex
CREATE INDEX `CreditAccount_importBatchId_idx` ON `CreditAccount`(`importBatchId`);

-- CreateIndex
CREATE INDEX `Expense_importBatchId_idx` ON `Expense`(`importBatchId`);

-- CreateIndex
CREATE INDEX `ImportBatch_portfolioId_idx` ON `ImportBatch`(`portfolioId`);

-- CreateIndex
CREATE INDEX `Income_importBatchId_idx` ON `Income`(`importBatchId`);

-- AddForeignKey
ALTER TABLE `Income` ADD CONSTRAINT `Income_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditAccount` ADD CONSTRAINT `CreditAccount_importBatchId_fkey` FOREIGN KEY (`importBatchId`) REFERENCES `ImportBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportBatch` ADD CONSTRAINT `ImportBatch_portfolioId_fkey` FOREIGN KEY (`portfolioId`) REFERENCES `Portfolio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
