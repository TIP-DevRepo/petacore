import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const VALID_DISTRIBUTORS = ["INGRAM_MICRO", "TD_SYNNEX", "DH", "AMAZON_BUSINESS"]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ distributor: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { distributor } = await params
  if (!VALID_DISTRIBUTORS.includes(distributor)) {
    return NextResponse.json({ error: "Unknown distributor" }, { status: 400 })
  }

  const body = await req.json()
  const companyId = session.user.companyId

  const data = {
    enabled: body.enabled ?? false,
    priority: Number(body.priority) || 0,
    apiKey: body.apiKey || null,
    clientId: body.clientId || null,
    clientSecret: body.clientSecret || null,
    partnerId: body.partnerId || null,
  }

  const record = await prisma.distributorIntegration.upsert({
    where: {
      companyId_distributor: {
        companyId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        distributor: distributor as any,
      },
    },
    update: data,
    create: {
      companyId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      distributor: distributor as any,
      ...data,
    },
  })

  return NextResponse.json(record)
}