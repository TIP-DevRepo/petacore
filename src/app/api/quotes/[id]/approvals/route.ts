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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const approvals = await prisma.quoteApproval.findMany({
    where: { quoteId: id },
    include: {
      workflow: {
        select: {
          name: true,
          triggerType: true,
          requiredRole: { select: { id: true, name: true, rank: true } },
        },
      },
      approvedByUser: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(approvals)
}