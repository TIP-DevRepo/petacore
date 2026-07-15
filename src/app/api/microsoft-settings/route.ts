import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/permissions"

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

  if (!(await hasPermission(session.user.id, "settingsSections.integrations"))) {
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