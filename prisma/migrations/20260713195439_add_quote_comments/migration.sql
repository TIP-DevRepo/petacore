-- CreateTable
CREATE TABLE "QuoteComment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteComment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuoteComment" ADD CONSTRAINT "QuoteComment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteComment" ADD CONSTRAINT "QuoteComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
