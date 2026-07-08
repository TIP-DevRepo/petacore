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

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const workflows = await prisma.approvalWorkflow.findMany({
    where: { companyId: session.user.companyId },
    include: { triggerUser: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(workflows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can create approval workflows" }, { status: 403 })
  }

  const body = await req.json()

  if (!body.name || !body.triggerType || !body.requiredRole) {
    return NextResponse.json({ error: "Name, trigger type, and required role are all required" }, { status: 400 })
  }

  const workflow = await prisma.approvalWorkflow.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      triggerType: body.triggerType,
      thresholdValue: body.thresholdValue != null ? Number(body.thresholdValue) : null,
      triggerUserId: body.triggerUserId || null,
      requiredRole: body.requiredRole,
      active: body.active ?? true,
    },
  })

  return NextResponse.json(workflow)
}