/*
  Warnings:

  - You are about to drop the column `title` on the `Evaluation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "title";

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualiCarriereQuestion" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
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
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResponse_questionId_key" ON "QualiCarriereResponse"("questionId");

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereQuestion" ADD CONSTRAINT "QualiCarriereQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QualiCarriereQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualiCarriereResponse" ADD CONSTRAINT "QualiCarriereResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
