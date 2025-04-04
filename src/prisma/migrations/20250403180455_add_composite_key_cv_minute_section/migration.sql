/*
  Warnings:

  - The primary key for the `CvMinuteSection` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `CvMinuteSection` table. All the data in the column will be lost.
  - You are about to drop the column `sectionName` on the `CvMinuteSection` table. All the data in the column will be lost.
  - You are about to drop the column `cvMinuteSectionId` on the `SectionInfo` table. All the data in the column will be lost.
  - Added the required column `cvMinuteId` to the `SectionInfo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `SectionInfo` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SectionInfo" DROP CONSTRAINT "SectionInfo_cvMinuteSectionId_fkey";

-- AlterTable
ALTER TABLE "CvMinuteSection" DROP CONSTRAINT "CvMinuteSection_pkey",
DROP COLUMN "id",
DROP COLUMN "sectionName",
ADD COLUMN     "sectionTitle" TEXT,
ADD CONSTRAINT "CvMinuteSection_pkey" PRIMARY KEY ("cvMinuteId", "sectionId");

-- AlterTable
ALTER TABLE "SectionInfo" DROP COLUMN "cvMinuteSectionId",
ADD COLUMN     "cvMinuteId" INTEGER NOT NULL,
ADD COLUMN     "sectionId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_cvMinuteId_sectionId_fkey" FOREIGN KEY ("cvMinuteId", "sectionId") REFERENCES "CvMinuteSection"("cvMinuteId", "sectionId") ON DELETE RESTRICT ON UPDATE CASCADE;
