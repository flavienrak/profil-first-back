/*
  Warnings:

  - You are about to drop the column `iconColor` on the `SectionInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SectionInfo" DROP COLUMN "iconColor",
ADD COLUMN     "company" TEXT,
ADD COLUMN     "contrat" TEXT,
ADD COLUMN     "date" TEXT,
ADD COLUMN     "title" TEXT;
