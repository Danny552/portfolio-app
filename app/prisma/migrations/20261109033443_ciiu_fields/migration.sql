/*
  Warnings:

  - Added the required column `divisionCode` to the `EconomicActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `divisionName` to the `EconomicActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupCode` to the `EconomicActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupName` to the `EconomicActivity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `EconomicActivity` ADD COLUMN `divisionCode` VARCHAR(191) NOT NULL,
    ADD COLUMN `divisionName` VARCHAR(400) NOT NULL,
    ADD COLUMN `groupCode` VARCHAR(191) NOT NULL,
    ADD COLUMN `groupName` VARCHAR(400) NOT NULL,
    MODIFY `description` VARCHAR(400) NOT NULL;
