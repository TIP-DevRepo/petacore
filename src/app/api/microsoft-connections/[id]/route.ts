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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can disconnect a mailbox" }, { status: 403 })
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