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
    where: { companyId: session.user.companyId },
    include: {
      client: { select: { name: true } },
      lineItems: { select: { unitPrice: true, quantity: true, discount: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = quotes.map((q) => {
    const total = q.lineItems.reduce((sum, li) => {
      const lineTotal = li.unitPrice * li.quantity * (1 - li.discount / 100)
      return sum + lineTotal
    }, 0)

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      clientName: q.client.name,
      total,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
    }
  })

  return NextResponse.json(result)
}