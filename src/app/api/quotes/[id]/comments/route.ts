import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const quote = await prisma.quote.findUnique({
    where: { id, companyId: session.user.companyId },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const comments = await prisma.quoteComment.findMany({
    where: { quoteId: id },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(comments)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  if (!body.message || !body.message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const quote = await prisma.quote.findUnique({
    where: { id, companyId: session.user.companyId },
    include: {
      client: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true, email: true } },
    },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  const comment = await prisma.quoteComment.create({
    data: {
      quoteId: id,
      authorType: "INTERNAL",
      authorUserId: session.user.id,
      authorName: session.user.name || "Team",
      message: body.message.trim(),
    },
  })

  // Notify the client that a new message is waiting for them
  const clientEmail = quote.contact?.email
  if (clientEmail) {
    const portalLink = `${req.nextUrl.origin}/portal/${quote.accessToken}`
    await sendQuoteNotificationEmail(
      id,
      clientEmail,
      `New message on Quote ${quote.quoteNumber}`,
      `<p>${comment.authorName} sent you a message on your quote:</p><blockquote>${body.message.trim().replace(/\n/g, "<br/>")}</blockquote><p><a href="${portalLink}">View and reply</a></p>`
    )
  }

  return NextResponse.json(comment)
}