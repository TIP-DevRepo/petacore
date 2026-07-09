import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { sendQuoteEmail } from "@/lib/send-quote-email"

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Higher number = more senior. ADMIN can approve anything.
const ROLE_RANK: Record<string, number> = {
  ADMIN: 4,
  MANAGER: 3,
  REP: 2,
  ESTIMATOR: 2,
  VIEWER: 1,
}

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; approvalId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id, approvalId } = await params
  const companyId = session.user.companyId

  const approval = await prisma.quoteApproval.findUnique({
    where: { id: approvalId },
    include: { workflow: true, quote: true },
  })
  if (!approval || approval.quoteId !== id || approval.quote.companyId !== companyId) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 })
  }
  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: "This approval has already been decided" }, { status: 400 })
  }

  const userRank = ROLE_RANK[session.user.role] ?? 0
  const requiredRank = ROLE_RANK[approval.workflow.requiredRole] ?? 99
  if (userRank < requiredRank) {
    return NextResponse.json(
      { error: `Only users with ${approval.workflow.requiredRole} permission or higher can approve this.` },
      { status: 403 }
    )
  }

  await prisma.quoteApproval.update({
    where: { id: approvalId },
    data: { status: "APPROVED", approvedByUserId: session.user.id, decidedAt: new Date() },
  })

  // If every requirement on this quote is now approved, complete the send
  const remaining = await prisma.quoteApproval.count({
    where: { quoteId: id, status: "PENDING" },
  })

  if (remaining === 0) {
    const quote = await prisma.quote.findUnique({ where: { id } })
    if (quote) {
      // If this quote was submitted through the Send Quote dialog, the
      // composed email was held until now — send it before going live
      if (quote.pendingEmailPayload) {
        const payload = quote.pendingEmailPayload as {
          to: string
          cc: string | null
          subject: string
          bodyHtml: string
          includePdf: boolean
        }
        const result = await sendQuoteEmail({ quoteId: id, ...payload })
        if (!result.success) {
          return NextResponse.json(
            { error: `Approved, but sending the email failed: ${result.error}` },
            { status: 500 }
          )
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.quote.updateMany({
          where: { companyId, quoteNumber: quote.quoteNumber, id: { not: id } },
          data: { isActive: false },
        })
        await tx.quote.update({
          where: { id },
          data: { status: "SENT", sentAt: new Date(), isActive: true, pendingEmailPayload: null },
        })
      })
    }
  }

  const updatedQuote = await prisma.quote.findUnique({ where: { id } })
  return NextResponse.json({ quote: updatedQuote, allApproved: remaining === 0 })
}