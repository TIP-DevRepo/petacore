import crypto from "crypto"

// A short-lived, HMAC-signed token proving "this request already passed a
// verified Microsoft SSO login for this specific user." It exists only to
// hand off from our custom OAuth callback to NextAuth's own Credentials
// provider, so NextAuth issues the session cookie itself rather than us
// trying to construct one by hand. 60 seconds is intentionally tight —
// it's consumed within the same request cycle, never shown to the user.

const SECRET = process.env.AUTH_SECRET!

export function createSsoRelayToken(userId: string): string {
  const expiresAt = Date.now() + 60_000
  const payload = `${userId}.${expiresAt}`
  const payloadB64 = Buffer.from(payload).toString("base64url")
  const signature = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex")
  return `${payloadB64}.${signature}`
}

export function verifySsoRelayToken(token: string): { userId: string } | null {
  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null

  const expectedSig = crypto.createHmac("sha256", SECRET).update(payloadB64).digest("hex")
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  const payload = Buffer.from(payloadB64, "base64url").toString()
  const [userId, expiresAtStr] = payload.split(".")
  const expiresAt = Number(expiresAtStr)
  if (!userId || !expiresAt || Date.now() > expiresAt) return null

  return { userId }
}