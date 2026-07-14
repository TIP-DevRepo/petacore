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

type NotifyEvent = "QUOTE_VIEWED" | "QUOTE_APPROVED" | "QUOTE_LOST"

const EVENT_COPY: Record<NotifyEvent, { verb: string; subjectVerb: string }> = {
  QUOTE_VIEWED: { verb: "viewed", subjectVerb: "was viewed" },
  QUOTE_APPROVED: { verb: "approved", subjectVerb: "was approved" },
  QUOTE_LOST: { verb: "declined", subjectVerb: "was declined" },
}

// Fires an in-app notification and an email to the quote's assigned rep.
// Called from the portal view/accept/decline routes whenever a client
// takes one of those actions. Email failures are logged, not thrown — a
// client accepting or declining a quote should never fail because a
// notification email couldn't send.
export async function notifyQuoteEvent(quoteId: string, event: NotifyEvent) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      client: { select: { name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })
  if (!quote) return

  const displayNumber = quote.version > 1 ? `${quote.quoteNumber} v${quote.version}` : quote.quoteNumber
  const { verb, subjectVerb } = EVENT_COPY[event]
  const message = `${quote.client.name} ${verb} quote ${displayNumber}`
  const link = `/dashboard/quotes/${quoteId}`

  await prisma.notification.create({
    data: {
      companyId: quote.companyId,
      userId: quote.userId,
      type: event,
      message,
      link,
    },
  })

  try {
    await sendQuoteNotificationEmail(
      quoteId,
      quote.user.email,
      `Quote ${displayNumber} ${subjectVerb}`,
      `<p>Hi ${quote.user.name},</p><p>${message}.</p><p><a href="${process.env.NEXTAUTH_URL ?? ""}${link}">View the quote</a></p>`
    )
  } catch (err) {
    console.error("Failed to send notification email:", err)
  }
}