/*
  Warnings:

  - You are about to drop the column `order` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Section` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CvMinuteSection" ADD COLUMN     "sectionOrder" INTEGER;

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "order",
DROP COLUMN "title";
