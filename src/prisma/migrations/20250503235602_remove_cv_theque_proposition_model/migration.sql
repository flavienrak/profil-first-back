/*
  Warnings:

  - You are about to drop the `CvThequeProposition` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `CvThequeUser` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CvThequeProposition" DROP CONSTRAINT "CvThequeProposition_cvThequeCritereId_fkey";

-- DropForeignKey
ALTER TABLE "CvThequeProposition" DROP CONSTRAINT "CvThequeProposition_userId_fkey";

-- AlterTable
ALTER TABLE "CvMinute" ADD COLUMN     "cvThequeCritereId" INTEGER,
ADD COLUMN     "generated" TEXT;

-- AlterTable
ALTER TABLE "CvThequeCritere" ADD COLUMN     "tenative" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CvThequeUser" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "OpenaiResponse" ADD COLUMN     "cvThequeCritereId" INTEGER;

-- DropTable
DROP TABLE "CvThequeProposition";

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
