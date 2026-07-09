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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id: quoteId } = await params

  // Confirm the quote belongs to this company before touching it
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId, companyId: session.user.companyId },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(quote.status)) {
    return NextResponse.json(
      { error: "This quote has been sent and is locked. Create a new version to make changes." },
      { status: 400 }
    )
  }

  const body = await req.json()

  // Next sortOrder = current highest + 1, so new items land at the bottom
  const highest = await prisma.quoteLineItem.findFirst({
    where: { quoteId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  const sortOrder = (highest?.sortOrder ?? -1) + 1

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      quoteId,
      catalogItemId: body.catalogItemId || null,
      section: body.section || null,
      sortOrder,
      name: body.name,
      description: body.description || null,
      sku: body.sku || null,
      quantity: Number(body.quantity) || 1,
      unitPrice: Number(body.unitPrice) || 0,
      cost: Number(body.cost) || 0,
      discount: Number(body.discount) || 0,
      taxable: body.taxable ?? true,
      isRecurring: body.isRecurring ?? false,
      recurringInterval: body.isRecurring ? body.recurringInterval || "MONTHLY" : null,
      isOptional: body.isOptional ?? false,
      quantityAdjustable: body.quantityAdjustable ?? false,
      choiceGroup: body.choiceGroup || null,
    },
  })

  return NextResponse.json(lineItem)
}