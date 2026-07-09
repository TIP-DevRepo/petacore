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

  const { id } = await params
  const companyId = session.user.companyId

  const source = await prisma.quote.findUnique({
    where: { id, companyId },
    include: { lineItems: true },
  })
  if (!source) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const settings = await prisma.companySettings.findUnique({ where: { companyId } })
  const prefix = settings?.quotePrefix ?? "Q"
  const year = new Date().getFullYear()
  const existingCount = await prisma.quote.count({ where: { companyId, version: 1 } })
  const quoteNumber = `${prefix}-${year}-${String(existingCount + 1).padStart(4, "0")}`

  const copy = await prisma.quote.create({
    data: {
      companyId,
      clientId: source.clientId,
      contactId: source.contactId,
      userId: source.userId,
      quoteNumber,
      templateId: source.templateId,
      title: source.title ? `${source.title} (Copy)` : null,
      introText: source.introText,
      terms: source.terms,
      internalNotes: source.internalNotes,
      clientPoNumber: source.clientPoNumber,
      expiresAt: source.expiresAt,
      taxRate: source.taxRate,
      lineItems: {
        create: source.lineItems.map((li) => ({
          catalogItemId: li.catalogItemId,
          section: li.section,
          sortOrder: li.sortOrder,
          name: li.name,
          description: li.description,
          sku: li.sku,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          cost: li.cost,
          discount: li.discount,
          taxable: li.taxable,
          isRecurring: li.isRecurring,
          recurringInterval: li.recurringInterval,
          isOptional: li.isOptional,
          optionalSelected: li.optionalSelected,
        })),
      },
    },
  })

  return NextResponse.json(copy)
}