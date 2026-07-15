import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

interface RolePermissions {
  settingsSections?: { users?: boolean }
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  const permissions = currentUser?.role?.permissions as RolePermissions | undefined
  if (!permissions?.settingsSections?.users) {
    return NextResponse.json({ error: "You don't have permission to invite users" }, { status: 403 })
  }

  const body = await req.json()
  const { name, email, roleId, tempPassword } = body

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 400 })
  }

  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } })
    if (!role || role.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
  }

  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  const user = await prisma.user.create({
    data: {
      companyId: session.user.companyId,
      name,
      email,
      password: hashedPassword,
      roleId: roleId || null,
    },
  })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email })
}