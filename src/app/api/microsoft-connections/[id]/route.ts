import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/permissions"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if (!(await hasPermission(session.user.id, "settingsSections.integrations"))) {
    return NextResponse.json({ error: "You don't have permission to disconnect a mailbox" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.microsoftConnection.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!existing) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 })
  }

  await prisma.microsoftConnection.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}