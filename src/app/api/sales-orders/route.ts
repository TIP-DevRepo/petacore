import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/permissions"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const canViewAll = await hasPermission(session.user.id, "salesOrders.viewAll")

  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      companyId: session.user.companyId,
      ...(canViewAll ? {} : { userId: session.user.id }),
    },
    include: {
      client: { select: { name: true } },
      user: { select: { id: true, name: true } },
      lineItems: { select: { unitPrice: true, quantity: true, discount: true, isTextBlock: true } },
      purchaseOrders: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = salesOrders.map((so) => {
    const total = so.lineItems
      .filter((li) => !li.isTextBlock)
      .reduce((sum, li) => sum + li.unitPrice * li.quantity * (1 - li.discount / 100), 0)

    return {
      id: so.id,
      soNumber: so.soNumber,
      status: so.status,
      clientPoNumber: so.clientPoNumber,
      clientName: so.client.name,
      owner: so.user,
      total,
      poCount: so.purchaseOrders.length,
      createdAt: so.createdAt,
    }
  })

  return NextResponse.json(result)
}