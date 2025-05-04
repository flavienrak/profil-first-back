/*
  Warnings:

  - You are about to drop the column `evaluated` on the `CvThequeCritere` table. All the data in the column will be lost.
  - You are about to drop the column `tenative` on the `CvThequeCritere` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CvThequeCritere" DROP COLUMN "evaluated",
DROP COLUMN "tenative",
ADD COLUMN     "evaluation" INTEGER NOT NULL DEFAULT 0;
