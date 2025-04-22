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

-- AddForeignKey
ALTER TABLE "QualiCarriereChat" ADD CONSTRAINT "QualiCarriereChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
