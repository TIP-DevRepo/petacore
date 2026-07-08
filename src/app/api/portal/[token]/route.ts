import { NextRequest, NextResponse } from "next/server"
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

// A portal token always resolves to whichever version of the quote family is
// currently active — this way an old link the client already has keeps
// working and automatically shows the latest sent version.
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const activeId = await resolveActiveQuoteId(token)
  if (!activeId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const quote = await prisma.quote.findUnique({
    where: { id: activeId },
    include: {
      client: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      user: { select: { name: true, email: true } },
      company: {
        select: {
          name: true,
          logoUrl: true,
          settings: { select: { primaryColor: true, accentColor: true } },
        },
      },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  // Auto-expire if past the expiry date and still in an open state
  const isExpired =
    quote.expiresAt &&
    quote.expiresAt < new Date() &&
    !["ACCEPTED", "DECLINED"].includes(quote.status)

  if (isExpired && quote.status !== "EXPIRED") {
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "EXPIRED" },
    })
    quote.status = "EXPIRED"
  } else if (quote.status === "SENT") {
    // First time the client opens it — mark as viewed
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: "VIEWED", viewedAt: quote.viewedAt ?? new Date() },
    })
    quote.status = "VIEWED"
    quote.viewedAt = quote.viewedAt ?? new Date()
  }

  return NextResponse.json(quote)
}