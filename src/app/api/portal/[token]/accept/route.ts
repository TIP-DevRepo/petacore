import { NextRequest, NextResponse } from "next/server"
import { notifyQuoteEvent } from "@/lib/notify"
import { createSalesOrderFromAcceptedQuote } from "@/lib/sales-orders"
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
  const body = await req.json().catch(() => ({}))

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

  // Acceptance requires a signature, a named signer, and agreeing to terms
  if (!body.signatureType || (body.signatureType !== "TYPED" && body.signatureType !== "DRAWN")) {
    return NextResponse.json({ error: "A signature is required" }, { status: 400 })
  }
  if (!body.signatureData || !String(body.signatureData).trim()) {
    return NextResponse.json({ error: "A signature is required" }, { status: 400 })
  }
  if (!body.signerName || !String(body.signerName).trim()) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 })
  }
  if (!body.termsAgreed) {
    return NextResponse.json({ error: "You must agree to the terms and conditions" }, { status: 400 })
  }

  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      signatureType: body.signatureType,
      signatureData: body.signatureData,
      signerName: body.signerName.trim(),
      termsAgreedAt: new Date(),
      clientPoNumber: body.clientPoNumber || quote.clientPoNumber,
      shipAddress: body.shipAddress !== undefined ? body.shipAddress || null : quote.shipAddress,
      shipCity: body.shipCity !== undefined ? body.shipCity || null : quote.shipCity,
      shipState: body.shipState !== undefined ? body.shipState || null : quote.shipState,
      shipZip: body.shipZip !== undefined ? body.shipZip || null : quote.shipZip,
      shipCountry: body.shipCountry !== undefined ? body.shipCountry || null : quote.shipCountry,
      shipContactName: body.shipContactName !== undefined ? body.shipContactName || null : quote.shipContactName,
    },
  })

  notifyQuoteEvent(quote.id, "QUOTE_APPROVED").catch((err) =>
    console.error("notifyQuoteEvent failed:", err)
  )

  createSalesOrderFromAcceptedQuote(quote.id).catch((err) =>
    console.error("createSalesOrderFromAcceptedQuote failed:", err)
  )

  return NextResponse.json(updated)
}