/*
  Warnings:

  - Made the column `internalAccessToken` on table `Quote` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "internalAccessToken" SET NOT NULL;
