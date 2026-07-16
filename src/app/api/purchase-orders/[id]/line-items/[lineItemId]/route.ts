import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function getOwnedLineItem(lineItemId: string, companyId: string) {
  const lineItem = await prisma.pOLineItem.findUnique({
    where: { id: lineItemId },
    include: { purchaseOrder: { select: { id: true, companyId: true } } },
  })
  if (!lineItem || lineItem.purchaseOrder.companyId !== companyId) return null
  return lineItem
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { lineItemId, id: poId } = await params
  const existing = await getOwnedLineItem(lineItemId, session.user.companyId)
  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.received !== undefined) data.received = Boolean(body.received)
  if (body.serialNumber !== undefined) data.serialNumber = body.serialNumber || null
  if (body.unitCost !== undefined) data.unitCost = Number(body.unitCost)
  if (body.quantity !== undefined) data.quantity = Number(body.quantity)

  const lineItem = await prisma.pOLineItem.update({ where: { id: lineItemId }, data })

  // If every line item on this PO is now received, auto-advance the PO
  // itself to Received — but only forward, never overrides a manual
  // On Hold/Backordered/Cancelled status
  if (body.received !== undefined) {
    const allItems = await prisma.pOLineItem.findMany({ where: { purchaseOrderId: poId } })
    const allReceived = allItems.every((li) => li.received)
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
    if (allReceived && po && po.status === "PARTS_ORDERED") {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: "RECEIVED", receivedAt: new Date() },
      })
    }
  }

  return NextResponse.json(lineItem)
}