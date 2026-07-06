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

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: session.user.companyId },
  })

  return NextResponse.json({
    emailDefaultCc: settings?.emailDefaultCc ?? "",
    emailSignature: settings?.emailSignature ?? "",
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const settings = await prisma.companySettings.upsert({
    where: { companyId: session.user.companyId },
    update: {
      emailDefaultCc: body.emailDefaultCc || null,
      emailSignature: body.emailSignature || null,
    },
    create: {
      companyId: session.user.companyId,
      emailDefaultCc: body.emailDefaultCc || null,
      emailSignature: body.emailSignature || null,
    },
  })

  return NextResponse.json(settings)
}