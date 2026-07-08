/*
  Warnings:

  - You are about to drop the column `outlookAccessToken` on the `CompanySettings` table. All the data in the column will be lost.
  - You are about to drop the column `outlookConnected` on the `CompanySettings` table. All the data in the column will be lost.
  - You are about to drop the column `outlookEmail` on the `CompanySettings` table. All the data in the column will be lost.
  - You are about to drop the column `outlookRefreshToken` on the `CompanySettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanySettings" DROP COLUMN "outlookAccessToken",
DROP COLUMN "outlookConnected",
DROP COLUMN "outlookEmail",
DROP COLUMN "outlookRefreshToken";

-- CreateTable
CREATE TABLE "MicrosoftConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftConnection_companyId_email_key" ON "MicrosoftConnection"("companyId", "email");

-- AddForeignKey
ALTER TABLE "MicrosoftConnection" ADD CONSTRAINT "MicrosoftConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicrosoftConnection" ADD CONSTRAINT "MicrosoftConnection_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
