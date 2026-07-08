import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const companyId = session.user.companyId

  const quote = await prisma.quote.findUnique({
    where: { id, companyId },
    include: { lineItems: true },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
  if (quote.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only draft quotes can be sent. A quote pending approval must be approved first." },
      { status: 400 }
    )
  }

  // ─── Evaluate active approval workflows against this quote ──────────────
  const workflows = await prisma.approvalWorkflow.findMany({
    where: { companyId, active: true },
  })

  const total = quote.lineItems.reduce(
    (sum, li) => sum + li.unitPrice * li.quantity * (1 - li.discount / 100),
    0
  )
  const maxDiscount = quote.lineItems.reduce((max, li) => Math.max(max, li.discount), 0)

  const matched = workflows.filter((w) => {
    if (w.triggerType === "TOTAL_THRESHOLD") {
      return w.thresholdValue != null && total >= w.thresholdValue
    }
    if (w.triggerType === "DISCOUNT_THRESHOLD") {
      return w.thresholdValue != null && maxDiscount >= w.thresholdValue
    }
    if (w.triggerType === "SPECIFIC_USER") {
      return w.triggerUserId === quote.userId
    }
    return false
  })

  if (matched.length > 0) {
    // Needs sign-off — create one pending approval per matched workflow and
    // hold the quote instead of sending it
    await prisma.$transaction([
      ...matched.map((w) =>
        prisma.quoteApproval.upsert({
          where: { quoteId_workflowId: { quoteId: id, workflowId: w.id } },
          update: { status: "PENDING", approvedByUserId: null, decidedAt: null, reason: null },
          create: { quoteId: id, workflowId: w.id, status: "PENDING" },
        })
      ),
      prisma.quote.update({ where: { id }, data: { status: "PENDING_APPROVAL" } }),
    ])

    const updated = await prisma.quote.findUnique({ where: { id } })
    return NextResponse.json(updated)
  }

  // No approval needed — send immediately
  const updated = await prisma.$transaction(async (tx) => {
    // This version becomes the one clients see; every other version in the
    // same quote family is archived (deactivated) but kept for history
    await tx.quote.updateMany({
      where: { companyId, quoteNumber: quote.quoteNumber, id: { not: id } },
      data: { isActive: false },
    })

    return tx.quote.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), isActive: true },
    })
  })

  return NextResponse.json(updated)
}