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
  const companyId = session.user.companyId

  const quote = await prisma.quote.findUnique({ where: { id, companyId } })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quote.updateMany({
      where: { companyId, quoteNumber: quote.quoteNumber, id: { not: id } },
      data: { isActive: false },
    })

    return tx.quote.update({
      where: { id },
      data: { isActive: true },
    })
  })

  return NextResponse.json(updated)
}