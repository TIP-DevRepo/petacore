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
  settingsSections?: { integrations?: boolean }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: session.user.companyId },
  })

  return NextResponse.json({
    microsoftClientId: settings?.microsoftClientId ?? "",
    microsoftTenantId: settings?.microsoftTenantId ?? "",
    hasClientSecret: !!settings?.microsoftClientSecret,
    ssoEnabled: settings?.ssoEnabled ?? false,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  const permissions = currentUser?.role?.permissions as RolePermissions | undefined
  if (!permissions?.settingsSections?.integrations) {
    return NextResponse.json({ error: "You don't have permission to configure Microsoft integration" }, { status: 403 })
  }

  const body = await req.json()

  const data: Record<string, unknown> = {}
  if (body.microsoftClientId !== undefined) data.microsoftClientId = body.microsoftClientId || null
  if (body.microsoftTenantId !== undefined) data.microsoftTenantId = body.microsoftTenantId || null
  if (body.microsoftClientSecret) data.microsoftClientSecret = body.microsoftClientSecret
  if (body.ssoEnabled !== undefined) data.ssoEnabled = Boolean(body.ssoEnabled)

  const settings = await prisma.companySettings.upsert({
    where: { companyId: session.user.companyId },
    update: data,
    create: { companyId: session.user.companyId, ...data },
  })

  return NextResponse.json({
    microsoftClientId: settings.microsoftClientId,
    microsoftTenantId: settings.microsoftTenantId,
    hasClientSecret: !!settings.microsoftClientSecret,
    ssoEnabled: settings.ssoEnabled,
  })
}