import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const templates = await prisma.quoteTemplate.findMany({
    where: { companyId: session.user.companyId },
    include: { lineItems: true },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const template = await prisma.quoteTemplate.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      description: body.description || null,
      introText: body.introText || null,
      terms: body.terms || null,
      expiryDays: Number(body.expiryDays) || 30,
      active: body.active ?? true,
    },
  })

  return NextResponse.json(template)
}