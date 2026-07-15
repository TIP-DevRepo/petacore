import { NextRequest, NextResponse } from "next/server"
import { notifyQuoteEvent } from "@/lib/notify"
import { prisma } from "@/lib/prisma"

async function resolveActiveQuoteId(token: string) {
  const matched = await prisma.quote.findUnique({
    where: { accessToken: token },
    select: { id: true, companyId: true, quoteNumber: true, isActive: true },
  })
  if (!matched) return null
  if (matched.isActive) return matched.id

  const active = await prisma.quote.findFirst({
    where: { companyId: matched.companyId, quoteNumber: matched.quoteNumber, isActive: true },
    select: { id: true },
  })
  return active?.id ?? matched.id
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const activeId = await resolveActiveQuoteId(token)
  if (!activeId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const quote = await prisma.quote.findUnique({ where: { id: activeId } })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
  if (quote.status === "ACCEPTED" || quote.status === "DECLINED") {
    return NextResponse.json({ error: "This quote has already been responded to" }, { status: 400 })
  }
  if (quote.status === "EXPIRED") {
    return NextResponse.json({ error: "This quote has expired" }, { status: 400 })
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  })

  notifyQuoteEvent(quote.id, "QUOTE_APPROVED").catch((err) =>
    console.error("notifyQuoteEvent failed:", err)
  )

  return NextResponse.json(updated)
}