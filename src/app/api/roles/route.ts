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

const DEFAULT_PERMISSIONS = {
  pages: { clients: false, catalog: false, vendors: false, quotes: false, settings: false },
  quotes: { create: false, edit: false, delete: false, changeStatus: false, approve: false, sendEmail: false, viewAllUsersQuotes: false },
  clients: { create: false, edit: false, delete: false, viewAllClients: false },
  settingsSections: { company: false, users: false, quotes: false, approvalWorkflows: false, notifications: false, integrations: false },
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const roles = await prisma.role.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { rank: "desc" },
  })

  return NextResponse.json(roles)
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
    return NextResponse.json({ error: "You don't have permission to create roles" }, { status: 403 })
  }

  const body = await req.json()
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const existing = await prisma.role.findUnique({
    where: { companyId_name: { companyId: session.user.companyId, name: body.name.trim() } },
  })
  if (existing) {
    return NextResponse.json({ error: "A role with that name already exists" }, { status: 400 })
  }

  const role = await prisma.role.create({
    data: {
      companyId: session.user.companyId,
      name: body.name.trim(),
      rank: Number(body.rank) || 0,
      permissions: DEFAULT_PERMISSIONS,
      isSystem: false,
    },
  })

  return NextResponse.json(role)
}