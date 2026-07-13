import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { sendQuoteNotificationEmail } from "@/lib/send-quote-email"

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

export const runtime = "nodejs"
export const maxDuration = 30

async function resolveActiveQuoteId(token: string) {
  const matched = await prisma.quote.findUnique({
    where: { accessToken: token },
    select: { id: true, companyId: true, quoteNumber: true, isActive: true },
  })
  if (!matched) return null
  if (matched.isActive) return matched.id

  const active = await prisma.quote.findFirst({
    where: { companyId: matched.companyId, quoteNumber: matched.quoteNumber, isActive: true },
    select: { id: true },
  })
  return active?.id ?? matched.id
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const activeId = await resolveActiveQuoteId(token)
  if (!activeId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const comments = await prisma.quoteComment.findMany({
    where: { quoteId: activeId },
    orderBy: { createdAt: "asc" },
    select: { id: true, authorType: true, authorName: true, message: true, createdAt: true },
  })

  return NextResponse.json(comments)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await req.json()
  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const activeId = await resolveActiveQuoteId(token)
  if (!activeId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const quote = await prisma.quote.findUnique({
    where: { id: activeId },
    include: {
      contact: { select: { firstName: true, lastName: true } },
      client: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const authorName = quote.contact
    ? `${quote.contact.firstName} ${quote.contact.lastName}`
    : quote.client.name

  const comment = await prisma.quoteComment.create({
    data: {
      quoteId: activeId,
      authorType: "CLIENT",
      authorName,
      message: body.message.trim(),
    },
  })

  // Notify the rep that the client replied
  const quoteDetailLink = `${req.nextUrl.origin}/dashboard/quotes/${activeId}`
  await sendQuoteNotificationEmail(
    activeId,
    quote.user.email,
    `New reply on Quote ${quote.quoteNumber} from ${authorName}`,
    `<p>${authorName} sent a message on Quote ${quote.quoteNumber}:</p><blockquote>${body.message.trim().replace(/\n/g, "<br/>")}</blockquote><p><a href="${quoteDetailLink}">View and reply</a></p>`
  )

  return NextResponse.json({
    id: comment.id,
    authorType: comment.authorType,
    authorName: comment.authorName,
    message: comment.message,
    createdAt: comment.createdAt,
  })
}