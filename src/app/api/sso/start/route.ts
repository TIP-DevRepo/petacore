import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

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