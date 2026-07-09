-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "quoteSendFromConnectionId" TEXT,
ADD COLUMN     "quoteSendFromMode" TEXT NOT NULL DEFAULT 'CREATOR';

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_quoteSendFromConnectionId_fkey" FOREIGN KEY ("quoteSendFromConnectionId") REFERENCES "MicrosoftConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
