/*
  Warnings:

  - You are about to drop the column `cvThequeCritereId` on the `CvThequeContact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[recruiterId,cvMinuteId]` on the table `CvThequeContact` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CvThequeContact" DROP CONSTRAINT "CvThequeContact_cvThequeCritereId_fkey";

-- AlterTable
ALTER TABLE "CvThequeContact" DROP COLUMN "cvThequeCritereId";

-- CreateIndex
CREATE UNIQUE INDEX "CvThequeContact_recruiterId_cvMinuteId_key" ON "CvThequeContact"("recruiterId", "cvMinuteId");
