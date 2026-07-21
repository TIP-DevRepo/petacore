import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getAdapter } from "@/lib/distributors/registry"
import { DistributorKey } from "@/lib/distributors/types"

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

const tiers = ["Standard", "Pro", "Enterprise"]

function mockResultsFor(query: string, distributor: string) {
  const count = seededNumber(`${query}-${distributor}-count`, 1, 3) // 1-2 results
  return Array.from({ length: count }).map((_, i) => {
    const seed = `${query}-${distributor}-${i}`
    const price = seededNumber(seed, 2000, 50000) / 100 // $20.00 - $500.00
    const cost = Math.round(price * 0.78 * 100) / 100 // mock ~22% margin
    const tier = tiers[seededNumber(seed + "-tier", 0, tiers.length)]
    return {
      id: seed,
      distributorKey: distributor,
      distributorLabel: DISTRIBUTOR_LABELS[distributor] ?? distributor,
      name: `${query} - ${tier}`,
      sku: `${distributor.slice(0, 3)}-${seededNumber(seed + "-sku", 10000, 99999)}`,
      price,
      cost,
      availability: seededNumber(seed + "-avail", 0, 250),
      isMock: true,
    }
  })
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

  const resultsByDistributor = await Promise.all(
    enabled.map(async (dist) => {
      const key = dist.distributor as DistributorKey
      const adapter = getAdapter(key)

      if (!adapter.isLive) {
        return mockResultsFor(query, dist.distributor)
      }

      try {
        const creds = {
          apiKey: dist.apiKey ?? "",
          clientId: dist.clientId ?? "",
          clientSecret: dist.clientSecret ?? "",
          partnerId: dist.partnerId ?? "",
        }
        const liveResults = await adapter.search(query, creds, dist.sandboxMode)
        return liveResults.map((r) => ({
          id: `${r.distributor}-${r.sku}`,
          distributorKey: r.distributor,
          distributorLabel: DISTRIBUTOR_LABELS[r.distributor] ?? r.distributor,
          name: r.name,
          sku: r.sku,
          price: r.msrp,
          cost: r.cost,
          availability: r.stock,
          isMock: r.isMock,
        }))
      } catch (err) {
        // If the live call fails, fall back to mock so the search UI
        // still returns something instead of erroring out entirely
        console.error(`${dist.distributor} live search failed:`, err)
        return mockResultsFor(query, dist.distributor)
      }
    })
  )

  const results = resultsByDistributor.flat()
  const anyLiveResults = results.some((r) => !r.isMock)

  return NextResponse.json({
    mock: !anyLiveResults,
    distributors: enabled.map((d) => DISTRIBUTOR_LABELS[d.distributor] ?? d.distributor),
    results,
    message: anyLiveResults
      ? "Live results from connected distributors, mixed with mock data for distributors still pending API approval."
      : "These are mock results — real distributor pricing/availability will replace this once Ingram/TD Synnex/D&H/Amazon approve API access.",
  })
}