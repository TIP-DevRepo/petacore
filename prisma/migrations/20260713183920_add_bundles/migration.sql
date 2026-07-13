-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "bundleDisplayMode" TEXT DEFAULT 'COLLAPSED',
ADD COLUMN     "bundleName" TEXT;
