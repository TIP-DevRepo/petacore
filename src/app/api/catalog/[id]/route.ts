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

  const item = await prisma.catalogItem.findUnique({
    where: { id, companyId: session.user.companyId },
  })

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json(item)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const item = await prisma.catalogItem.update({
    where: { id, companyId: session.user.companyId },
    data: {
      name: body.name,
      description: body.description || null,
      sku: body.sku || null,
      category: body.category || null,
      subcategory: body.subcategory || null,
      type: body.type,
      msrp: Number(body.msrp) || 0,
      cost: Number(body.cost) || 0,
      unit: body.unit || "each",
      taxable: body.taxable,
      active: body.active,
    },
  })

  return NextResponse.json(item)
}