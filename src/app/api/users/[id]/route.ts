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
  settingsSections?: { users?: boolean }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Permission check now runs against the actual Role record instead of a
  // hardcoded "ADMIN" string, since roles are user-defined going forward
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  const permissions = currentUser?.role?.permissions as RolePermissions | undefined
  if (!permissions?.settingsSections?.users) {
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