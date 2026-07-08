import { NextRequest, NextResponse } from "next/server"
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = body.email as string | undefined

  if (!email) {
    return NextResponse.json({ ssoRequired: false })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { include: { settings: true } } },
  })

  const settings = user?.company?.settings
  const ssoRequired = !!(
    settings?.ssoEnabled &&
    settings.microsoftClientId &&
    settings.microsoftTenantId
  )

  return NextResponse.json({ ssoRequired })
}