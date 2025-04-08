/*
  Warnings:

  - The `iconSize` column on the `SectionInfo` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "SectionInfo" DROP COLUMN "iconSize",
ADD COLUMN     "iconSize" INTEGER;
