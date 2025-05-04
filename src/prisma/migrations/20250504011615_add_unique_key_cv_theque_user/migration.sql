/*
  Warnings:

  - A unique constraint covering the columns `[userId,cvThequeCritereId]` on the table `CvThequeUser` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CvThequeUser_userId_cvThequeCritereId_key" ON "CvThequeUser"("userId", "cvThequeCritereId");
