import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import crypto from "crypto"

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

const SCOPES = "openid profile offline_access User.Read Mail.Send Mail.ReadWrite"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const label = req.nextUrl.searchParams.get("label")?.trim()
  if (!label) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=missing_label", req.url)
    )
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: session.user.companyId },
  })

  if (!settings?.microsoftClientId || !settings?.microsoftTenantId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=missing_credentials", req.url)
    )
  }

  const redirectUri = `${req.nextUrl.origin}/api/microsoft/callback`
  const state = crypto.randomUUID()

  const authorizeUrl = new URL(
    `https://login.microsoftonline.com/${settings.microsoftTenantId}/oauth2/v2.0/authorize`
  )
  authorizeUrl.searchParams.set("client_id", settings.microsoftClientId)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("response_mode", "query")
  authorizeUrl.searchParams.set("scope", SCOPES)
  authorizeUrl.searchParams.set("state", state)
  // Let the user pick which account to sign into, rather than silently
  // reusing whichever Microsoft session is already active in the browser —
  // important since they may be connecting a second or third mailbox
  authorizeUrl.searchParams.set("prompt", "select_account")

  const response = NextResponse.redirect(authorizeUrl.toString())
  response.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })
  response.cookies.set("ms_oauth_label", label, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  return response
}