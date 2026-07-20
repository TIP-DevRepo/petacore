-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "signatureData" TEXT,
ADD COLUMN     "signatureType" TEXT,
ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "termsAgreedAt" TIMESTAMP(3);
