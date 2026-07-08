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

// Confirms the line item exists and belongs to a quote owned by this company
async function getOwnedLineItem(lineItemId: string, companyId: string) {
  const lineItem = await prisma.quoteLineItem.findUnique({
    where: { id: lineItemId },
    include: { quote: { select: { companyId: true, status: true } } },
  })
  if (!lineItem || lineItem.quote.companyId !== companyId) return null
  return lineItem
}

const LOCK_MESSAGE =
  "This quote has been sent and is locked. Create a new version to make changes."

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { lineItemId } = await params
  const existing = await getOwnedLineItem(lineItemId, session.user.companyId)
  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 })
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(existing.quote.status)) {
    return NextResponse.json({ error: LOCK_MESSAGE }, { status: 400 })
  }

  const body = await req.json()

  // Only update fields that were actually sent, so partial saves (e.g. one
  // field losing focus) don't clobber the rest of the row
  const data: Record<string, unknown> = {}
  if (body.section !== undefined) data.section = body.section || null
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder)
  if (body.name !== undefined) data.name = body.name
  if (body.description !== undefined) data.description = body.description || null
  if (body.sku !== undefined) data.sku = body.sku || null
  if (body.quantity !== undefined) data.quantity = Number(body.quantity)
  if (body.unitPrice !== undefined) data.unitPrice = Number(body.unitPrice)
  if (body.cost !== undefined) data.cost = Number(body.cost)
  if (body.discount !== undefined) data.discount = Number(body.discount)
  if (body.taxable !== undefined) data.taxable = Boolean(body.taxable)
  if (body.isOptional !== undefined) data.isOptional = Boolean(body.isOptional)
  if (body.isRecurring !== undefined) {
    data.isRecurring = Boolean(body.isRecurring)
    data.recurringInterval = body.isRecurring ? body.recurringInterval || "MONTHLY" : null
  } else if (body.recurringInterval !== undefined) {
    data.recurringInterval = body.recurringInterval
  }

  const lineItem = await prisma.quoteLineItem.update({
    where: { id: lineItemId },
    data,
  })

  return NextResponse.json(lineItem)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { lineItemId } = await params
  const existing = await getOwnedLineItem(lineItemId, session.user.companyId)
  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 })
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(existing.quote.status)) {
    return NextResponse.json({ error: LOCK_MESSAGE }, { status: 400 })
  }

  await prisma.quoteLineItem.delete({ where: { id: lineItemId } })

  return NextResponse.json({ deleted: true })
}