/*
  Warnings:

  - You are about to drop the column `title` on the `Evaluation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CvMinute" DROP CONSTRAINT "CvMinute_userId_fkey";

-- DropForeignKey
ALTER TABLE "CvMinuteSection" DROP CONSTRAINT "CvMinuteSection_cvMinuteId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_userId_fkey";

-- AlterTable
ALTER TABLE "CvMinute" ADD COLUMN     "qualiCarriereRef" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "title";

-- AlterTable
ALTER TABLE "OpenaiResponse" ADD COLUMN     "userId" INTEGER;

-- CreateTable
CREATE TABLE "QualiCarriereQuestion" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "sectionInfoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereResponse" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "sectionInfoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereResume" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "sectionInfoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereCompetence" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "sectionInfoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereChat" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResponse_questionId_key" ON "QualiCarriereResponse"("questionId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QualiCarriereQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereCompetence" ADD CONSTRAINT "QualiCarriereCompetence_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereCompetence" ADD CONSTRAINT "QualiCarriereCompetence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereChat" ADD CONSTRAINT "QualiCarriereChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
