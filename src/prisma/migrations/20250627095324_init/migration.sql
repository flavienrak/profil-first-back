-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'candidat',
    "qualiCarriere" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInfos" (
    "id" SERIAL NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'system',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "acceptFreeUse" BOOLEAN NOT NULL DEFAULT false,
    "acceptConditions" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInfos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "cvMinuteId" INTEGER,
    "cvMinuteSectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinute" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'CV',
    "position" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "primaryBg" TEXT NOT NULL DEFAULT '#2A7F8B',
    "secondaryBg" TEXT NOT NULL DEFAULT '#1A5F6B',
    "tertiaryBg" TEXT NOT NULL DEFAULT '#BEDBFF',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "qualiCarriereRef" BOOLEAN NOT NULL DEFAULT false,
    "generated" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvMinute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinuteDomain" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvMinuteDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvMinuteSection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "date" TEXT,
    "contrat" TEXT,
    "icon" TEXT,
    "iconSize" INTEGER,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "cvMinuteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvMinuteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advice" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cvMinuteId" INTEGER,
    "cvMinuteSectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "cvMinuteSectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenaiResponse" (
    "id" SERIAL NOT NULL,
    "responseId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "cvMinuteId" INTEGER,
    "userId" INTEGER,
    "cvThequeCritereId" INTEGER,
    "cvMinuteSectionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenaiResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereQuestion" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualiCarriereQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereResponse" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualiCarriereResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereResume" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualiCarriereResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereCompetence" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvMinuteSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualiCarriereCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereChat" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "evaluation" INTEGER NOT NULL DEFAULT 0,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeCritere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeCompetence" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeView" (
    "id" SERIAL NOT NULL,
    "count" INTEGER NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeUser" (
    "id" SERIAL NOT NULL,
    "score" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvThequeCritereId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeContact" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "userId" INTEGER NOT NULL,
    "recruiterId" INTEGER NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeContactView" (
    "id" SERIAL NOT NULL,
    "count" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvThequeContactId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvThequeContactView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "priceId" TEXT,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiredAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" SERIAL NOT NULL,
    "value" INTEGER NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserInfos_userId_key" ON "UserInfos"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_cvMinuteId_key" ON "Evaluation"("cvMinuteId");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_cvMinuteSectionId_key" ON "Evaluation"("cvMinuteSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResponse_questionId_key" ON "QualiCarriereResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResume_cvMinuteSectionId_key" ON "QualiCarriereResume"("cvMinuteSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CvThequeView_cvMinuteId_key" ON "CvThequeView"("cvMinuteId");

-- CreateIndex
CREATE UNIQUE INDEX "CvThequeUser_userId_cvThequeCritereId_key" ON "CvThequeUser"("userId", "cvThequeCritereId");

-- CreateIndex
CREATE UNIQUE INDEX "CvThequeContact_recruiterId_cvMinuteId_key" ON "CvThequeContact"("recruiterId", "cvMinuteId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_sessionId_key" ON "Payment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Credit_paymentId_key" ON "Credit"("paymentId");

-- AddForeignKey
ALTER TABLE "UserInfos" ADD CONSTRAINT "UserInfos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteDomain" ADD CONSTRAINT "CvMinuteDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteDomain" ADD CONSTRAINT "CvMinuteDomain_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advice" ADD CONSTRAINT "Advice_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QualiCarriereQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereCompetence" ADD CONSTRAINT "QualiCarriereCompetence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereCompetence" ADD CONSTRAINT "QualiCarriereCompetence_cvMinuteSectionId_fkey" FOREIGN KEY ("cvMinuteSectionId") REFERENCES "CvMinuteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContactView" ADD CONSTRAINT "CvThequeContactView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContactView" ADD CONSTRAINT "CvThequeContactView_cvThequeContactId_fkey" FOREIGN KEY ("cvThequeContactId") REFERENCES "CvThequeContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
