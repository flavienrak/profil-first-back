-- AlterTable
ALTER TABLE "SectionInfo" ADD COLUMN     "score" TEXT;

-- CreateTable
CREATE TABLE "OpenaiResponse" (
    "id" SERIAL NOT NULL,
    "responseId" TEXT NOT NULL,
    "cvMinuteId" INTEGER,
    "request" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenaiResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE SET NULL ON UPDATE CASCADE;
