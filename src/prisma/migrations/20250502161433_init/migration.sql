-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "acceptConditions" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "qualiCarriere" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDomain" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvMinuteId" INTEGER,
    "sectionInfoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinute" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'CV',
    "position" TEXT NOT NULL,
    "primaryBg" TEXT NOT NULL DEFAULT '#2A7F8B',
    "secondaryBg" TEXT NOT NULL DEFAULT '#1A5F6B',
    "tertiaryBg" TEXT NOT NULL DEFAULT '#BEDBFF',
    "userId" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "qualiCarriereRef" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvMinute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinuteSection" (
    "id" SERIAL NOT NULL,
    "sectionOrder" INTEGER,
    "sectionTitle" TEXT,
    "cvMinuteId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,

    CONSTRAINT "CvMinuteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionInfo" (
    "id" SERIAL NOT NULL,
    "order" INTEGER,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "date" TEXT,
    "contrat" TEXT,
    "icon" TEXT,
    "iconSize" INTEGER,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advice" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cvMinuteId" INTEGER,
    "sectionInfoId" INTEGER,
    "cvMinuteSectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" SERIAL NOT NULL,
    "initialScore" INTEGER NOT NULL,
    "actualScore" INTEGER,
    "content" TEXT NOT NULL,
    "weakContent" TEXT,
    "cvMinuteId" INTEGER,
    "sectionInfoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenaiResponse" (
    "id" SERIAL NOT NULL,
    "responseId" TEXT NOT NULL,
    "cvMinuteId" INTEGER,
    "userId" INTEGER,
    "request" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenaiResponse_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "CvThequeCritere" (
    "id" SERIAL NOT NULL,
    "position" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "diplome" TEXT NOT NULL DEFAULT '',
    "localisation" TEXT NOT NULL DEFAULT '',
    "distance" INTEGER NOT NULL DEFAULT 0,
    "experience" INTEGER,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "evaluated" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeCritere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeCompetence" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeView" (
    "id" SERIAL NOT NULL,
    "count" INTEGER NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeUser" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,

    CONSTRAINT "CvThequeUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeProposition" (
    "id" SERIAL NOT NULL,
    "section" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeProposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "File_sectionInfoId_key" ON "File"("sectionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CvMinuteSection_cvMinuteId_sectionId_key" ON "CvMinuteSection"("cvMinuteId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_cvMinuteId_key" ON "Evaluation"("cvMinuteId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_sectionInfoId_key" ON "Evaluation"("sectionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResponse_questionId_key" ON "QualiCarriereResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResume_sectionInfoId_key" ON "QualiCarriereResume"("sectionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "CvThequeView_cvMinuteId_key" ON "CvThequeView"("cvMinuteId");

-- AddForeignKey
ALTER TABLE "UserDomain" ADD CONSTRAINT "UserDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "CvThequeCritere" ADD CONSTRAINT "CvThequeCritere_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeCompetence" ADD CONSTRAINT "CvThequeCompetence_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeView" ADD CONSTRAINT "CvThequeView_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeView" ADD CONSTRAINT "CvThequeView_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeUser" ADD CONSTRAINT "CvThequeUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeUser" ADD CONSTRAINT "CvThequeUser_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeProposition" ADD CONSTRAINT "CvThequeProposition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeProposition" ADD CONSTRAINT "CvThequeProposition_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
