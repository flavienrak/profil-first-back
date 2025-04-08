/*
  Warnings:

  - Made the column `font` on table `SectionInfo` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SectionInfo" ALTER COLUMN "font" SET NOT NULL,
ALTER COLUMN "font" SET DEFAULT 'normal';
