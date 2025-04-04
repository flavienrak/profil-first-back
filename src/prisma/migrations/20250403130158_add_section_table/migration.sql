-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinuteSection" (
    "id" SERIAL NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,

    CONSTRAINT "CvMinuteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionInfo" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionInfo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
