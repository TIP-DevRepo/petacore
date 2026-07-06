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

  const clients = await prisma.client.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      industry: true,
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const client = await prisma.client.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      industry: body.industry || null,
      status: body.status || "PROSPECT",
      billAddress: body.billAddress || null,
      billCity: body.billCity || null,
      billState: body.billState || null,
      billZip: body.billZip || null,
      billCountry: body.billCountry || null,
      shipAddress: body.shipAddress || null,
      shipCity: body.shipCity || null,
      shipState: body.shipState || null,
      shipZip: body.shipZip || null,
      shipCountry: body.shipCountry || null,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(client)
}