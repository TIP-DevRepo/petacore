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

interface RolePermissions {
  quotes?: { changeStatus?: boolean }
}

const VALID_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  const permissions = currentUser?.role?.permissions as RolePermissions | undefined
  if (!permissions?.quotes?.changeStatus) {
    return NextResponse.json({ error: "You don't have permission to change a quote's status manually" }, { status: 403 })
  }

  const { id } = await params
  const companyId = session.user.companyId
  const body = await req.json()

  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({ where: { id, companyId } })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = { status: body.status }
  if (body.status === "SENT" && !quote.sentAt) data.sentAt = new Date()
  if (body.status === "ACCEPTED" && !quote.acceptedAt) data.acceptedAt = new Date()
  if (body.status === "DECLINED" && !quote.declinedAt) data.declinedAt = new Date()

  // Manually marking a quote SENT should make it the live version, same as
  // the normal send flow
  if (body.status === "SENT") {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.quote.updateMany({
        where: { companyId, quoteNumber: quote.quoteNumber, id: { not: id } },
        data: { isActive: false },
      })
      return tx.quote.update({ where: { id }, data: { ...data, isActive: true } })
    })
    return NextResponse.json(updated)
  }

  const updated = await prisma.quote.update({ where: { id }, data })
  return NextResponse.json(updated)
}