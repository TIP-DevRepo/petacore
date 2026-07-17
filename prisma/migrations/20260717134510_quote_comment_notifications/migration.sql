-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'QUOTE_COMMENT';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "lastCommentViewedAt" TIMESTAMP(3);
