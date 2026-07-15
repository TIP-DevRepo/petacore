import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const clients = await prisma.client.findMany({
    where: { companyId: session.user.companyId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      industry: true,
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await req.json()

  const client = await prisma.client.create({
    data: {
      companyId: session.user.companyId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      industry: body.industry || null,
      status: body.status || "PROSPECT",
      billAddress: body.billAddress || null,
      billCity: body.billCity || null,
      billState: body.billState || null,
      billZip: body.billZip || null,
      billCountry: body.billCountry || null,
      shipAddress: body.shipAddress || null,
      shipCity: body.shipCity || null,
      shipState: body.shipState || null,
      shipZip: body.shipZip || null,
      shipCountry: body.shipCountry || null,
      notes: body.notes || null,
    },
  })

  return NextResponse.json(client)
}