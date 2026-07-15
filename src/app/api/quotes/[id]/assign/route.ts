import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  if (!body.userId) {
    return NextResponse.json({ error: "A user is required" }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { id: body.userId, companyId: session.user.companyId },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 400 })
  }

  const updated = await prisma.quote.update({
    where: { id },
    data: { userId: body.userId },
  })

  return NextResponse.json(updated)
}