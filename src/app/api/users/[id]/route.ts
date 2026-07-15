import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/permissions"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if (!(await hasPermission(session.user.id, "settingsSections.users"))) {
    return NextResponse.json({ error: "You don't have permission to edit users" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { roleId, active } = body

  // If a roleId was sent, confirm it actually belongs to this company
  // before assigning it — prevents assigning a role from another company
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role || role.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id, companyId: session.user.companyId },
    data: {
      ...(roleId !== undefined ? { roleId } : {}),
      ...(active !== undefined ? { active } : {}),
    },
    include: { role: true },
  })

  return NextResponse.json({ id: updated.id, role: updated.role, active: updated.active })
}