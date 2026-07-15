import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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