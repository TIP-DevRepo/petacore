import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const DISTRIBUTOR_LABELS: Record<string, string> = {
  INGRAM_MICRO: "Ingram Micro",
  TD_SYNNEX: "TD Synnex",
  DH: "D&H",
  AMAZON_BUSINESS: "Amazon Business",
}

// Deterministic pseudo-random number from a string, so the same search term
// always returns the same mock results instead of changing every time
function seededNumber(seed: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return min + (hash % (max - min))
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const query = req.nextUrl.searchParams.get("q")?.trim()
  if (!query) {
    return NextResponse.json({ error: "A search term is required" }, { status: 400 })
  }

  const enabled = await prisma.distributorIntegration.findMany({
    where: { companyId: session.user.companyId, enabled: true },
    orderBy: { priority: "asc" },
  })

  if (enabled.length === 0) {
    return NextResponse.json({
      mock: true,
      distributors: [],
      results: [],
      message:
        "No distributors are enabled yet. Go to Settings → Integrations → Distributor Integrations to connect one.",
    })
  }

  const tiers = ["Standard", "Pro", "Enterprise"]

  const results = enabled.flatMap((dist) => {
    const count = seededNumber(`${query}-${dist.distributor}-count`, 1, 3) // 1-2 results
    return Array.from({ length: count }).map((_, i) => {
      const seed = `${query}-${dist.distributor}-${i}`
      const price = seededNumber(seed, 2000, 50000) / 100 // $20.00 - $500.00
      const cost = Math.round(price * 0.78 * 100) / 100 // mock ~22% margin
      const tier = tiers[seededNumber(seed + "-tier", 0, tiers.length)]
      return {
        id: seed,
        distributorKey: dist.distributor,
        distributorLabel: DISTRIBUTOR_LABELS[dist.distributor] ?? dist.distributor,
        name: `${query} - ${tier}`,
        sku: `${dist.distributor.slice(0, 3)}-${seededNumber(seed + "-sku", 10000, 99999)}`,
        price,
        cost,
        availability: seededNumber(seed + "-avail", 0, 250),
      }
    })
  })

  return NextResponse.json({
    mock: true,
    distributors: enabled.map((d) => DISTRIBUTOR_LABELS[d.distributor] ?? d.distributor),
    results,
    message:
      "These are mock results — real distributor pricing/availability will replace this once Ingram/TD Synnex/D&H/Amazon approve API access.",
  })
}