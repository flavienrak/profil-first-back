/*
  Warnings:

  - Added the required column `index` to the `OpenaiResponse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OpenaiResponse" ADD COLUMN     "index" INTEGER NOT NULL;
