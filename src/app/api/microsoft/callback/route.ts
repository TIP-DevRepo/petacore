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

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  const msError = req.nextUrl.searchParams.get("error_description")
  const expectedState = req.cookies.get("ms_oauth_state")?.value
  const label = req.cookies.get("ms_oauth_label")?.value

  if (msError) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?panel=microsoft&error=${encodeURIComponent(msError)}`, req.url)
    )
  }
  if (!code || !state || state !== expectedState || !label) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=invalid_state", req.url)
    )
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: session.user.companyId },
  })
  if (!settings?.microsoftClientId || !settings?.microsoftTenantId || !settings?.microsoftClientSecret) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=missing_credentials", req.url)
    )
  }

  const redirectUri = `${req.nextUrl.origin}/api/microsoft/callback`

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
    const errText = await tokenRes.text()
    console.error("Microsoft token exchange failed:", errText)
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=token_exchange_failed", req.url)
    )
  }

  const tokens = await tokenRes.json()

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const me = meRes.ok ? await meRes.json() : null
  const email = me?.mail || me?.userPrincipalName || null

  if (!email) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?panel=microsoft&error=could_not_read_email", req.url)
    )
  }

  // One row per connected mailbox — reconnecting the same mailbox updates
  // its tokens and label rather than creating a duplicate
  await prisma.microsoftConnection.upsert({
    where: {
      companyId_email: { companyId: session.user.companyId, email },
    },
    update: {
      label,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      connectedByUserId: session.user.id,
    },
    create: {
      companyId: session.user.companyId,
      label,
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      connectedByUserId: session.user.id,
    },
  })

  const response = NextResponse.redirect(
    new URL("/dashboard/settings?panel=microsoft&connected=1", req.url)
  )
  response.cookies.delete("ms_oauth_state")
  response.cookies.delete("ms_oauth_label")
  return response
}