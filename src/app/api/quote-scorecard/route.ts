import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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