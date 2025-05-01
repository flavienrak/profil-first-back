-- CreateTable
CREATE TABLE "CvCritere" (
    "id" SERIAL NOT NULL,
    "position" TEXT NOT NULL,
    "description" TEXT,
    "experience" INTEGER,
    "diplome" TEXT,
    "localisation" TEXT,
    "distance" INTEGER,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CvCritere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvCritereCompetence" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "cvCritereId" INTEGER NOT NULL,

    CONSTRAINT "CvCritereCompetence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CvCritere" ADD CONSTRAINT "CvCritere_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvCritereCompetence" ADD CONSTRAINT "CvCritereCompetence_cvCritereId_fkey" FOREIGN KEY ("cvCritereId") REFERENCES "CvCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
