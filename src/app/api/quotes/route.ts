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

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: session.user.companyId },
    include: {
      client: { select: { name: true } },
      lineItems: { select: { unitPrice: true, quantity: true, discount: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = quotes.map((q) => {
    const total = q.lineItems.reduce((sum, li) => {
      const lineTotal = li.unitPrice * li.quantity * (1 - li.discount / 100)
      return sum + lineTotal
    }, 0)

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      clientName: q.client.name,
      total,
      createdAt: q.createdAt,
      expiresAt: q.expiresAt,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  if (!body.clientId) {
    return NextResponse.json({ error: "A client is required" }, { status: 400 })
  }

  const companyId = session.user.companyId

  // Pull default terms/expiry from Company Settings
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
  })
  const prefix = settings?.quotePrefix ?? "Q"

  // If a template was selected, load it (with its line items) to prefill from
  let templateLineItems: {
    catalogItemId: string | null
    name: string
    quantity: number
    discount: number
    sortOrder: number
    unitPrice: number
    cost: number
    taxable: boolean
  }[] = []
  let templateTerms: string | null = null

  if (body.templateId) {
    const template = await prisma.quoteTemplate.findUnique({
      where: { id: body.templateId, companyId },
      include: { lineItems: { include: { catalogItem: true } } },
    })

    if (template) {
      templateTerms = template.terms
      templateLineItems = template.lineItems.map((tli) => ({
        catalogItemId: tli.catalogItemId,
        name: tli.name,
        quantity: tli.quantity,
        discount: tli.discount,
        sortOrder: tli.sortOrder,
        unitPrice: tli.catalogItem?.msrp ?? 0,
        cost: tli.catalogItem?.cost ?? 0,
        taxable: tli.catalogItem?.taxable ?? true,
      }))
    }
  }

  // Generate the next sequential quote number for this company
  const year = new Date().getFullYear()
  const existingCount = await prisma.quote.count({ where: { companyId } })
  const quoteNumber = `${prefix}-${year}-${String(existingCount + 1).padStart(4, "0")}`

  // Expiry date: explicit date from the form, or today + expiry days
  const expiryDays = Number(body.expiryDays) || settings?.quoteExpiryDays || 30
  const expiresAt = body.expiresAt
    ? new Date(body.expiresAt)
    : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const quote = await prisma.quote.create({
    data: {
      companyId,
      clientId: body.clientId,
      contactId: body.contactId || null,
      userId: body.userId || session.user.id,
      quoteNumber,
      title: body.title || null,
      introText: body.introText || null,
      terms: body.terms || templateTerms || settings?.quoteTerms || null,
      internalNotes: body.internalNotes || null,
      clientPoNumber: body.clientPoNumber || null,
      expiresAt,
      lineItems: {
        create: templateLineItems,
      },
    },
  })

  return NextResponse.json(quote)
}