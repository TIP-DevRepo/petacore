/*
  Warnings:

  - A unique constraint covering the columns `[internalAccessToken]` on the table `Quote` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "internalAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Quote_internalAccessToken_key" ON "Quote"("internalAccessToken");
