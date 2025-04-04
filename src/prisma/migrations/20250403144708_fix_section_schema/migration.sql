/*
  Warnings:

  - A unique constraint covering the columns `[fileId]` on the table `SectionInfo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `font` to the `SectionInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CvMinute" ADD COLUMN     "background" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN     "primaryColor" TEXT NOT NULL DEFAULT '#2A7F8B';

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "order" INTEGER,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "SectionInfo" ADD COLUMN     "background" TEXT NOT NULL DEFAULT 'transparent',
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#000000',
ADD COLUMN     "fileId" INTEGER,
ADD COLUMN     "font" TEXT NOT NULL,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "iconColor" TEXT,
ADD COLUMN     "iconSize" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SectionInfo_fileId_key" ON "SectionInfo"("fileId");

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
