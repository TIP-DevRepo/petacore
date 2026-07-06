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

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const items = await prisma.catalogItem.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      type: true,
      msrp: true,
      cost: true,
      taxable: true,
      active: true,
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const item = await prisma.catalogItem.create({
    data: {
      companyId: session.user.companyId,
      vendorId: body.vendorId || null,
      name: body.name,
      description: body.description || null,
      sku: body.sku || null,
      category: body.category || null,
      subcategory: body.subcategory || null,
      type: body.type || "PHYSICAL",
      msrp: Number(body.msrp) || 0,
      cost: Number(body.cost) || 0,
      unit: body.unit || "each",
      taxable: body.taxable ?? true,
      active: body.active ?? true,
    },
  })

  return NextResponse.json(item)
}