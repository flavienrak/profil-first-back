-- AlterTable
ALTER TABLE "CvMinute" ADD COLUMN     "visible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "qualiCarriere" TEXT NOT NULL DEFAULT '';
