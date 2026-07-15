import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { sendQuoteEmail } from "@/lib/send-quote-email"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 30

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
  const body = await req.json()

  if (!body.to || !body.subject || !body.bodyHtml) {
    return NextResponse.json({ error: "To, subject, and message are required" }, { status: 400 })
  }

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

  const emailPayload = {
    to: body.to,
    cc: body.cc || null,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    includePdf: body.includePdf ?? true,
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
    if (w.triggerType === "TOTAL_THRESHOLD") return w.thresholdValue != null && total >= w.thresholdValue
    if (w.triggerType === "DISCOUNT_THRESHOLD") return w.thresholdValue != null && maxDiscount >= w.thresholdValue
    if (w.triggerType === "SPECIFIC_USER") return w.triggerUserId === quote.userId
    return false
  })

  if (matched.length > 0) {
    // Needs sign-off — hold the composed email until it's approved
    await prisma.$transaction([
      ...matched.map((w) =>
        prisma.quoteApproval.upsert({
          where: { quoteId_workflowId: { quoteId: id, workflowId: w.id } },
          update: { status: "PENDING", approvedByUserId: null, decidedAt: null, reason: null },
          create: { quoteId: id, workflowId: w.id, status: "PENDING" },
        })
      ),
      prisma.quote.update({
        where: { id },
        data: { status: "PENDING_APPROVAL", pendingEmailPayload: emailPayload },
      }),
    ])

    const updated = await prisma.quote.findUnique({ where: { id } })
    return NextResponse.json({ ...updated, pendingApproval: true })
  }

  // No approval needed — send the email right now
  const result = await sendQuoteEmail({ quoteId: id, ...emailPayload })
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
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