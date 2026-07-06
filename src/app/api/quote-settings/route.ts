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
    quotePrefix: settings?.quotePrefix ?? "Q",
    quoteExpiryDays: settings?.quoteExpiryDays ?? 30,
    quoteTerms: settings?.quoteTerms ?? "",
    quoteDefaultCc: settings?.quoteDefaultCc ?? "",
    quoteApprovalThreshold: settings?.quoteApprovalThreshold ?? null,
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
      quotePrefix: body.quotePrefix,
      quoteExpiryDays: Number(body.quoteExpiryDays),
      quoteTerms: body.quoteTerms || null,
      quoteDefaultCc: body.quoteDefaultCc || null,
      quoteApprovalThreshold: body.quoteApprovalThreshold ? Number(body.quoteApprovalThreshold) : null,
    },
    create: {
      companyId: session.user.companyId,
      quotePrefix: body.quotePrefix,
      quoteExpiryDays: Number(body.quoteExpiryDays),
      quoteTerms: body.quoteTerms || null,
      quoteDefaultCc: body.quoteDefaultCc || null,
      quoteApprovalThreshold: body.quoteApprovalThreshold ? Number(body.quoteApprovalThreshold) : null,
    },
  })

  return NextResponse.json(settings)
}