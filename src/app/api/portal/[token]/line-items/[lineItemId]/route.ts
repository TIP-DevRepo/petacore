import { NextRequest, NextResponse } from "next/server"
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; lineItemId: string }> }
) {
  const { token, lineItemId } = await params
  const body = await req.json()

  const quote = await prisma.quote.findUnique({ where: { accessToken: token } })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }
  if (["ACCEPTED", "DECLINED", "EXPIRED"].includes(quote.status)) {
    return NextResponse.json({ error: "This quote can no longer be modified" }, { status: 400 })
  }

  const lineItem = await prisma.quoteLineItem.findUnique({ where: { id: lineItemId } })
  if (!lineItem || lineItem.quoteId !== quote.id) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 })
  }
  if (!lineItem.isOptional) {
    return NextResponse.json({ error: "This item is not optional" }, { status: 400 })
  }

  const updated = await prisma.quoteLineItem.update({
    where: { id: lineItemId },
    data: { optionalSelected: Boolean(body.optionalSelected) },
  })

  return NextResponse.json(updated)
}