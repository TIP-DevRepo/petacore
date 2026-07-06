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

  const templates = await prisma.quoteTemplate.findMany({
    where: { companyId: session.user.companyId },
    include: { lineItems: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const template = await prisma.quoteTemplate.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      description: body.description || null,
      introText: body.introText || null,
      terms: body.terms || null,
      expiryDays: Number(body.expiryDays) || 30,
      active: body.active ?? true,
    },
  })

  return NextResponse.json(template)
}