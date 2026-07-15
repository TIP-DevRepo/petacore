import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  const item = await prisma.catalogItem.findUnique({
    where: { id, companyId: session.user.companyId },
  })

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  return NextResponse.json(item)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const item = await prisma.catalogItem.update({
    where: { id, companyId: session.user.companyId },
    data: {
      name: body.name,
      description: body.description || null,
      sku: body.sku || null,
      category: body.category || null,
      subcategory: body.subcategory || null,
      type: body.type,
      msrp: Number(body.msrp) || 0,
      cost: Number(body.cost) || 0,
      unit: body.unit || "each",
      taxable: body.taxable,
      active: body.active,
    },
  })

  return NextResponse.json(item)
}