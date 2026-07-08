import { NextResponse } from "next/server"
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

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: session.user.companyId, isActive: true },
    include: {
      lineItems: { select: { unitPrice: true, quantity: true, discount: true } },
    },
  })

  const counts: Record<string, number> = {
    DRAFT: 0,
    PENDING_APPROVAL: 0,
    SENT: 0,
    VIEWED: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    EXPIRED: 0,
  }

  let totalValue = 0
  let acceptedValue = 0

  for (const q of quotes) {
    counts[q.status] = (counts[q.status] ?? 0) + 1

    const quoteTotal = q.lineItems.reduce((sum, li) => {
      return sum + li.unitPrice * li.quantity * (1 - li.discount / 100)
    }, 0)

    totalValue += quoteTotal
    if (q.status === "ACCEPTED") acceptedValue += quoteTotal
  }

  return NextResponse.json({
    totalQuotes: quotes.length,
    counts,
    totalValue,
    acceptedValue,
  })
}