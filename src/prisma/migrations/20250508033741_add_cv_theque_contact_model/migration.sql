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
    "cvThequeCritereId" INTEGER NOT NULL,
    "cvMinuteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvThequeContactView" (
    "id" SERIAL NOT NULL,
    "count" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "cvThequeContactId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvThequeContactView_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_cvThequeCritereId_fkey" FOREIGN KEY ("cvThequeCritereId") REFERENCES "CvThequeCritere"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContact" ADD CONSTRAINT "CvThequeContact_cvMinuteId_fkey" FOREIGN KEY ("cvMinuteId") REFERENCES "CvMinute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContactView" ADD CONSTRAINT "CvThequeContactView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvThequeContactView" ADD CONSTRAINT "CvThequeContactView_cvThequeContactId_fkey" FOREIGN KEY ("cvThequeContactId") REFERENCES "CvThequeContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
