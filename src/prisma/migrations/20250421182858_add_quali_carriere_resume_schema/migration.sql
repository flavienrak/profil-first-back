-- CreateTable
CREATE TABLE "QualiCarriereResume" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualiCarriereResume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QualiCarriereResume_userId_key" ON "QualiCarriereResume"("userId");

-- AddForeignKey
ALTER TABLE "QualiCarriereResume" ADD CONSTRAINT "QualiCarriereResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
