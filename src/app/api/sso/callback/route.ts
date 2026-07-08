import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { signIn } from "@/auth"
import { createSsoRelayToken } from "@/lib/sso-relay-token"

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

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const msError = req.nextUrl.searchParams.get("error_description")
  const expectedState = req.cookies.get("sso_state")?.value
  const companyId = req.cookies.get("sso_company")?.value

  if (msError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msError)}`, req.url))
  }
  if (!code || !state || state !== expectedState || !companyId) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url))
  }

  const settings = await prisma.companySettings.findUnique({ where: { companyId } })
  if (
    !settings?.ssoEnabled ||
    !settings.microsoftClientId ||
    !settings.microsoftTenantId ||
    !settings.microsoftClientSecret
  ) {
    return NextResponse.redirect(new URL("/login?error=sso_not_available", req.url))
  }

  const redirectUri = `${req.nextUrl.origin}/api/sso/callback`

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${settings.microsoftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.microsoftClientId,
        client_secret: settings.microsoftClientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }
  )
  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", req.url))
  }
  const tokens = await tokenRes.json()

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!meRes.ok) {
    return NextResponse.redirect(new URL("/login?error=could_not_read_profile", req.url))
  }
  const me = await meRes.json()
  const email: string | undefined = me.mail || me.userPrincipalName
  const msId: string | undefined = me.id

  if (!email) {
    return NextResponse.redirect(new URL("/login?error=no_email_on_account", req.url))
  }

  // Identity comes only from what Microsoft just verified — never from
  // anything the browser sent us. Match by Microsoft ID first (once
  // linked), falling back to email for the very first sign-in.
  let user = msId
    ? await prisma.user.findFirst({ where: { companyId, microsoftId: msId } })
    : null
  if (!user) {
    user = await prisma.user.findFirst({ where: { companyId, email } })
  }

  if (!user || !user.active) {
    return NextResponse.redirect(new URL("/login?error=no_account_found", req.url))
  }

  // Link the Microsoft account and auto-save the mailbox/calendar
  // connection, so there's no separate "connect your mailbox" step
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { microsoftId: msId },
    }),
    prisma.microsoftConnection.upsert({
      where: { companyId_email: { companyId, email } },
      update: {
        label: user.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        connectedByUserId: user.id,
      },
      create: {
        companyId,
        label: user.name,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        connectedByUserId: user.id,
      },
    }),
  ])

  const relayToken = createSsoRelayToken(user.id)
  // NextAuth issues the actual session cookie itself here — we never
  // construct one by hand
  await signIn("sso", { token: relayToken, redirect: false })

  const response = NextResponse.redirect(new URL("/dashboard", req.url))
  response.cookies.delete("sso_state")
  response.cookies.delete("sso_company")
  return response
}