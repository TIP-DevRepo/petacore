/*
  Warnings:

  - The values [SENT,ACKNOWLEDGED,IN_PROGRESS,PARTIAL] on the enum `POStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `status` column on the `SalesOrder` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `requiredRoleId` on table `ApprovalWorkflow` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'READY_TO_INVOICE', 'INVOICED', 'READY_TO_ORDER', 'PARTS_ORDERED', 'READY_TO_CLOSEOUT', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SO_READY_TO_INVOICE';
ALTER TYPE "NotificationType" ADD VALUE 'SO_READY_TO_ORDER';
ALTER TYPE "NotificationType" ADD VALUE 'SO_READY_TO_CLOSEOUT';

-- AlterEnum
BEGIN;
CREATE TYPE "POStatus_new" AS ENUM ('DRAFT', 'PARTS_ORDERED', 'RECEIVED', 'ON_HOLD', 'BACKORDERED', 'CANCELLED');
ALTER TABLE "public"."PurchaseOrder" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" TYPE "POStatus_new" USING ("status"::text::"POStatus_new");
ALTER TYPE "POStatus" RENAME TO "POStatus_old";
ALTER TYPE "POStatus_new" RENAME TO "POStatus";
DROP TYPE "public"."POStatus_old";
ALTER TABLE "PurchaseOrder" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "ApprovalWorkflow" DROP CONSTRAINT "ApprovalWorkflow_requiredRoleId_fkey";

-- AlterTable
ALTER TABLE "ApprovalWorkflow" ALTER COLUMN "requiredRoleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "soStatusNotifyRules" JSONB;

-- AlterTable
ALTER TABLE "POLineItem" ADD COLUMN     "sourceSOLineItemId" TEXT;

-- AlterTable
ALTER TABLE "SOLineItem" ADD COLUMN     "bundleDisplayMode" TEXT DEFAULT 'COLLAPSED',
ADD COLUMN     "bundleName" TEXT,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isBundleHeader" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTextBlock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SalesOrder" DROP COLUMN "status",
ADD COLUMN     "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT';

-- AddForeignKey
ALTER TABLE "POLineItem" ADD CONSTRAINT "POLineItem_sourceSOLineItemId_fkey" FOREIGN KEY ("sourceSOLineItemId") REFERENCES "SOLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_requiredRoleId_fkey" FOREIGN KEY ("requiredRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
