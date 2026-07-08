import { NextRequest, NextResponse } from "next/server"
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

// Requests the same login + mailbox/calendar scopes in one consent screen,
// so users never need a separate "connect your mailbox" step
const SCOPES = "openid profile email offline_access User.Read Mail.Send Mail.ReadWrite Calendars.ReadWrite"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=missing_email", req.url))
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { include: { settings: true } } },
  })
  const settings = user?.company?.settings

  if (!user || !settings?.ssoEnabled || !settings.microsoftClientId || !settings.microsoftTenantId) {
    return NextResponse.redirect(new URL("/login?error=sso_not_available", req.url))
  }

  const redirectUri = `${req.nextUrl.origin}/api/sso/callback`
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
  authorizeUrl.searchParams.set("prompt", "select_account")

  const response = NextResponse.redirect(authorizeUrl.toString())
  response.cookies.set("sso_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })
  response.cookies.set("sso_company", user.companyId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  })

  return response
}