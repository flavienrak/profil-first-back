-- CreateTable
CREATE TABLE "CvMinute" (
    "id" SERIAL NOT NULL,
    "position" TEXT NOT NULL,
    "fileId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvMinute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvMinute_fileId_key" ON "CvMinute"("fileId");

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvMinute" ADD CONSTRAINT "CvMinute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
