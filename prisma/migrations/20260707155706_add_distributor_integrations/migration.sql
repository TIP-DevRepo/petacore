-- CreateEnum
CREATE TYPE "DistributorKey" AS ENUM ('INGRAM_MICRO', 'TD_SYNNEX', 'DH', 'AMAZON_BUSINESS');

-- CreateTable
CREATE TABLE "DistributorIntegration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "distributor" "DistributorKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "apiKey" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "partnerId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributorIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DistributorIntegration_companyId_distributor_key" ON "DistributorIntegration"("companyId", "distributor");

-- AddForeignKey
ALTER TABLE "DistributorIntegration" ADD CONSTRAINT "DistributorIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;