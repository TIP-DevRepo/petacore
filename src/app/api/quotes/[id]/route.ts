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
  quotes?: { delete?: boolean }
}

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
    include: {
      client: { select: { id: true, name: true, email: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      user: { select: { id: true, name: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  })

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  return NextResponse.json(quote)
}

export async function DELETE(
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
  if (!permissions?.quotes?.delete) {
    return NextResponse.json({ error: "You don't have permission to delete quotes" }, { status: 403 })
  }

  const { id } = await params

  const quote = await prisma.quote.findUnique({
    where: { id, companyId: session.user.companyId },
    include: { salesOrder: { select: { id: true } } },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
  if (quote.salesOrder) {
    return NextResponse.json(
      { error: "This quote has a Sales Order linked to it and can't be deleted." },
      { status: 400 }
    )
  }

  await prisma.quote.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}