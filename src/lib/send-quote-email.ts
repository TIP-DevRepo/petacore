import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { buildQuotePdfHtml } from "@/lib/quote-pdf-template"
import chromium from "@sparticuz/chromium"
import puppeteer from "puppeteer-core"

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

const SCOPES = "openid profile email offline_access User.Read Mail.Send Mail.ReadWrite Calendars.ReadWrite"

export interface SendQuoteEmailInput {
  quoteId: string
  to: string
  cc?: string | null
  subject: string
  bodyHtml: string
  includePdf: boolean
}

export interface SendQuoteEmailResult {
  success: boolean
  error?: string
}

function toRecipients(list: string) {
  return list
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }))
}

export async function sendQuoteEmail(input: SendQuoteEmailInput): Promise<SendQuoteEmailResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: input.quoteId },
    include: {
      client: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      user: { select: { id: true, name: true, email: true } },
      company: { select: { name: true, logoUrl: true, settings: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  })
  if (!quote) return { success: false, error: "Quote not found" }

  const settings = quote.company.settings
  if (!settings?.microsoftClientId || !settings.microsoftTenantId || !settings.microsoftClientSecret) {
    return { success: false, error: "Microsoft integration isn't configured for this company." }
  }

  // Figure out which connected mailbox to send from
  let connection =
    settings.quoteSendFromMode === "SPECIFIC" && settings.quoteSendFromConnectionId
      ? await prisma.microsoftConnection.findUnique({ where: { id: settings.quoteSendFromConnectionId } })
      : await prisma.microsoftConnection.findFirst({
          where: { companyId: quote.companyId, connectedByUserId: quote.userId },
        })

  if (!connection) {
    return {
      success: false,
      error:
        settings.quoteSendFromMode === "SPECIFIC"
          ? "The mailbox configured in Quote Settings is no longer connected."
          : "The rep who created this quote hasn't connected a mailbox yet (Settings → Microsoft Integration).",
    }
  }

  // Refresh the access token before using it — simpler and more reliable
  // than tracking expiry ourselves
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${settings.microsoftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.microsoftClientId,
        client_secret: settings.microsoftClientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
        scope: SCOPES,
      }),
    }
  )
  if (!tokenRes.ok) {
    return {
      success: false,
      error: "Couldn't refresh the connected mailbox's access. It may need to be reconnected.",
    }
  }
  const tokens = await tokenRes.json()

  await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || connection.refreshToken,
    },
  })

  // Optionally attach the branded PDF
  const attachments: Record<string, unknown>[] = []
  if (input.includePdf) {
    const html = buildQuotePdfHtml(quote, {
      name: quote.company.name,
      logoUrl: quote.company.logoUrl,
      primaryColor: settings.primaryColor,
      accentColor: settings.accentColor,
    })

    const isVercel = !!process.env.VERCEL
    const browser = isVercel
      ? await puppeteer.launch({
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        })
      : await (await import("puppeteer")).launch({ headless: true })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: "load" })
      const pdfBuffer = await page.pdf({
        format: "letter",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      })
      attachments.push({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: `${quote.quoteNumber}${quote.version > 1 ? `-v${quote.version}` : ""}.pdf`,
        contentType: "application/pdf",
        contentBytes: Buffer.from(pdfBuffer).toString("base64"),
      })
    } finally {
      await browser.close()
    }
  }

  const message = {
    subject: input.subject,
    body: { contentType: "HTML", content: input.bodyHtml },
    toRecipients: toRecipients(input.to),
    ccRecipients: input.cc ? toRecipients(input.cc) : [],
    attachments,
  }

  const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (!sendRes.ok) {
    const errText = await sendRes.text()
    console.error("Microsoft Graph sendMail failed:", errText)
    return { success: false, error: "Microsoft rejected the email. Please try again." }
  }

  return { success: true }
}

// Shared mailbox-picking + send logic for any company-level notification
// email (not tied to a specific quote). If quoteSendFromMode is SPECIFIC,
// uses that configured mailbox; otherwise prefers the given user's own
// connected mailbox, falling back to any connected mailbox for the company.
export async function sendCompanyNotificationEmail(
  companyId: string,
  to: string,
  subject: string,
  bodyHtml: string,
  preferredUserId?: string
): Promise<SendQuoteEmailResult> {
  const settings = await prisma.companySettings.findUnique({ where: { companyId } })
  if (!settings?.microsoftClientId || !settings.microsoftTenantId || !settings.microsoftClientSecret) {
    return { success: false, error: "Microsoft integration isn't configured for this company." }
  }

  let connection =
    settings.quoteSendFromMode === "SPECIFIC" && settings.quoteSendFromConnectionId
      ? await prisma.microsoftConnection.findUnique({ where: { id: settings.quoteSendFromConnectionId } })
      : preferredUserId
        ? await prisma.microsoftConnection.findFirst({ where: { companyId, connectedByUserId: preferredUserId } })
        : null

  if (!connection) {
    connection = await prisma.microsoftConnection.findFirst({ where: { companyId } })
  }

  if (!connection) {
    return { success: false, error: "No connected mailbox available to send from." }
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${settings.microsoftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.microsoftClientId,
        client_secret: settings.microsoftClientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
        scope: SCOPES,
      }),
    }
  )
  if (!tokenRes.ok) {
    return { success: false, error: "Couldn't refresh the connected mailbox's access." }
  }
  const tokens = await tokenRes.json()

  await prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || connection.refreshToken,
    },
  })

  const message = {
    subject,
    body: { contentType: "HTML", content: bodyHtml },
    toRecipients: toRecipients(to),
  }

  const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (!sendRes.ok) {
    const errText = await sendRes.text()
    console.error("Microsoft Graph sendMail failed:", errText)
    return { success: false, error: "Microsoft rejected the email." }
  }

  return { success: true }
}

// Kept for existing quote-event notification call sites — same behavior as
// before, now implemented as a thin wrapper around the shared company-level
// sender above.
export async function sendQuoteNotificationEmail(
  quoteId: string,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<SendQuoteEmailResult> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { companyId: true, userId: true },
  })
  if (!quote) return { success: false, error: "Quote not found" }
  return sendCompanyNotificationEmail(quote.companyId, to, subject, bodyHtml, quote.userId)
}