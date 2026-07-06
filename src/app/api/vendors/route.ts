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

  const vendors = await prisma.vendor.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      email: true,
      phone: true,
      isDistributor: true,
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(vendors)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const vendor = await prisma.vendor.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      type: body.type || "SUPPLIER",
      status: body.status || "ACTIVE",
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      address: body.address || null,
      paymentTerms: body.paymentTerms || null,
      leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
      notes: body.notes || null,
      isDistributor: body.isDistributor || false,
    },
  })

  return NextResponse.json(vendor)
}