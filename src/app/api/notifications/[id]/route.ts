import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  // Confirm this notification belongs to the requesting user before touching it
  const existing = await prisma.notification.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  })

  return NextResponse.json(updated)
}