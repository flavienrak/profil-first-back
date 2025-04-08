-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "acceptConditions" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "position" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#2A7F8B',
    "background" TEXT NOT NULL DEFAULT '#FFFFFF',
    "userId" INTEGER NOT NULL,
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
    "sectionOrder" INTEGER,
    "sectionTitle" TEXT,
    "cvMinuteId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,

    CONSTRAINT "CvMinuteSection_pkey" PRIMARY KEY ("cvMinuteId","sectionId")
);

-- CreateTable
CREATE TABLE "SectionInfo" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "font" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#000000',
    "background" TEXT NOT NULL DEFAULT 'transparent',
    "icon" TEXT,
    "iconColor" TEXT,
    "iconSize" TEXT,
    "cvMinuteId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "File_sectionInfoId_key" ON "File"("sectionInfoId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_sectionInfoId_fkey" FOREIGN KEY ("sectionInfoId") REFERENCES "SectionInfo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinuteSection" ADD CONSTRAINT "CvMinuteSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionInfo" ADD CONSTRAINT "SectionInfo_cvMinuteId_sectionId_fkey" FOREIGN KEY ("cvMinuteId", "sectionId") REFERENCES "CvMinuteSection"("cvMinuteId", "sectionId") ON DELETE RESTRICT ON UPDATE CASCADE;
