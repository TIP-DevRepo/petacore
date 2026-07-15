import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission, type RolePermissions } from "@/lib/permissions"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, "settingsSections.users"))) {
    return NextResponse.json({ error: "You don't have permission to edit roles" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.role.findUnique({ where: { id } })
  if (!existing || existing.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 })
  }

  const body = await req.json()

  // If this edit would remove Settings > Users access from this role, make
  // sure at least one OTHER role in the company still has it — otherwise
  // nobody could ever manage roles/users again
  if (body.permissions !== undefined) {
    const willHaveUsersAccess = !!body.permissions?.settingsSections?.users
    const hadUsersAccess = !!(existing.permissions as RolePermissions)?.settingsSections?.users
    if (hadUsersAccess && !willHaveUsersAccess) {
      const otherRolesWithAccess = await prisma.role.findMany({
        where: { companyId: session.user.companyId, id: { not: id } },
      })
      const stillCovered = otherRolesWithAccess.some(
        (r) => !!(r.permissions as RolePermissions)?.settingsSections?.users
      )
      if (!stillCovered) {
        return NextResponse.json(
          { error: "Can't remove Users & Roles access — this is the only role that has it. At least one role must be able to manage users." },
          { status: 400 }
        )
      }
    }
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.rank !== undefined) data.rank = Number(body.rank)
  if (body.permissions !== undefined) data.permissions = body.permissions

  const role = await prisma.role.update({ where: { id }, data })

  return NextResponse.json(role)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!(await hasPermission(session.user.id, "settingsSections.users"))) {
    return NextResponse.json({ error: "You don't have permission to delete roles" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.role.findUnique({
    where: { id },
    include: { users: { select: { id: true } } },
  })
  if (!existing || existing.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 })
  }

  if (existing.users.length > 0) {
    return NextResponse.json(
      { error: `This role is assigned to ${existing.users.length} user(s). Reassign them to a different role before deleting.` },
      { status: 400 }
    )
  }

  // Don't allow deleting the last role that can manage Users & Roles —
  // that would permanently lock everyone out of ever fixing this
  const permissions = existing.permissions as RolePermissions
  if (permissions?.settingsSections?.users) {
    const otherRoles = await prisma.role.findMany({
      where: { companyId: session.user.companyId, id: { not: id } },
    })
    const stillCovered = otherRoles.some(
      (r) => !!(r.permissions as RolePermissions)?.settingsSections?.users
    )
    if (!stillCovered) {
      return NextResponse.json(
        { error: "Can't delete this role — it's the only one that can manage Users & Roles." },
        { status: 400 }
      )
    }
  }

  await prisma.role.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}