-- AlterTable
ALTER TABLE "SectionInfo" ADD COLUMN     "conseil" TEXT,
ADD COLUMN     "suggestion" TEXT,
ALTER COLUMN "content" DROP NOT NULL;
