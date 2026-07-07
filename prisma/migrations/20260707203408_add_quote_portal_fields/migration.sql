-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "portalComment" TEXT,
ADD COLUMN     "portalCommentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "optionalSelected" BOOLEAN NOT NULL DEFAULT true;
