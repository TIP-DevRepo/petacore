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

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    include: { settings: true },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  return NextResponse.json({
    name: company.name,
    logoUrl: company.logoUrl,
    primaryColor: company.settings?.primaryColor ?? "#1B3A5C",
    accentColor: company.settings?.accentColor ?? "#2E86AB",
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()
  const { name, primaryColor, accentColor } = body

  await prisma.company.update({
    where: { id: session.user.companyId },
    data: { name },
  })

  await prisma.companySettings.upsert({
    where: { companyId: session.user.companyId },
    update: { primaryColor, accentColor },
    create: {
      companyId: session.user.companyId,
      primaryColor,
      accentColor,
    },
  })

  return NextResponse.json({ success: true })
}