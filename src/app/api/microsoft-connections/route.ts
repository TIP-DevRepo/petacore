import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const connections = await prisma.microsoftConnection.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      label: true,
      email: true,
      connectedByUser: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(connections)
}