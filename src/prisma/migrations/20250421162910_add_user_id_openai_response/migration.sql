-- AlterTable
ALTER TABLE "OpenaiResponse" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "OpenaiResponse" ADD CONSTRAINT "OpenaiResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
