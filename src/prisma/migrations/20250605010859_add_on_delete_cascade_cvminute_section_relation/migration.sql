-- DropForeignKey
ALTER TABLE "Advice" DROP CONSTRAINT "Advice_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_cvMinuteId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "OpenaiResponse" DROP CONSTRAINT "OpenaiResponse_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "QualiCarriereCompetence" DROP CONSTRAINT "QualiCarriereCompetence_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "QualiCarriereQuestion" DROP CONSTRAINT "QualiCarriereQuestion_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "QualiCarriereResponse" DROP CONSTRAINT "QualiCarriereResponse_cvMinuteSectionId_fkey";

-- DropForeignKey
ALTER TABLE "QualiCarriereResume" DROP CONSTRAINT "QualiCarriereResume_cvMinuteSectionId_fkey";

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereCompetence" ADD CONSTRAINT "QualiCarriereCompetence_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
