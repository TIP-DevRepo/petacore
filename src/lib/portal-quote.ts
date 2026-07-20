import { prisma } from "@/lib/prisma"

// A client-facing portal link always resolves to the family's most recently
// SENT version — never a draft-in-progress. If v2 is still being edited
// but v1 was the last one actually sent, the client keeps seeing v1 until
// v2 goes through the normal Send flow.
export async function resolveClientQuoteId(accessToken: string): Promise<string | null> {
  const matched = await prisma.quote.findUnique({
    where: { accessToken },
    select: { id: true, companyId: true, quoteNumber: true, sentAt: true, status: true },
  })
  if (!matched) return null

  // If this exact version has been sent (or further along), it's the one
  // to show — covers the common case directly without an extra query
  if (matched.sentAt) return matched.id

  // Otherwise, find the most recently sent version in the same family
  const lastSent = await prisma.quote.findFirst({
    where: { companyId: matched.companyId, quoteNumber: matched.quoteNumber, sentAt: { not: null } },
    orderBy: { version: "desc" },
    select: { id: true },
  })
  return lastSent?.id ?? null
}

// An internal-facing portal link always resolves to the newest version in
// the family, regardless of status — lets the team preview an in-progress
// draft before it's sent to the client.
export async function resolveInternalQuoteId(internalAccessToken: string): Promise<string | null> {
  const matched = await prisma.quote.findUnique({
    where: { internalAccessToken },
    select: { id: true, companyId: true, quoteNumber: true },
  })
  if (!matched) return null

  const newest = await prisma.quote.findFirst({
    where: { companyId: matched.companyId, quoteNumber: matched.quoteNumber },
    orderBy: { version: "desc" },
    select: { id: true },
  })
  return newest?.id ?? matched.id
}

// Given either kind of token, figures out which one it is and resolves
// accordingly, plus reports back whether it was the internal token — the
// main portal page uses this to decide whether to show client actions
// (Accept/Decline/Comment) or an internal-only preview.
export async function resolvePortalToken(
  token: string
): Promise<{ quoteId: string; isInternal: boolean } | null> {
  const asClient = await prisma.quote.findUnique({ where: { accessToken: token }, select: { id: true } })
  if (asClient) {
    const quoteId = await resolveClientQuoteId(token)
    return quoteId ? { quoteId, isInternal: false } : null
  }

  const asInternal = await prisma.quote.findUnique({ where: { internalAccessToken: token }, select: { id: true } })
  if (asInternal) {
    const quoteId = await resolveInternalQuoteId(token)
    return quoteId ? { quoteId, isInternal: true } : null
  }

  return null
}