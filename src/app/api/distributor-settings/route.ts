import { NextResponse } from "next/server"
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

const DISTRIBUTORS = ["INGRAM_MICRO", "TD_SYNNEX", "DH", "AMAZON_BUSINESS"] as const

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const existing = await prisma.distributorIntegration.findMany({
    where: { companyId: session.user.companyId },
  })

  // Always return one entry per known distributor, even if it hasn't been
  // configured yet, so the settings page always shows all four cards
  const result = DISTRIBUTORS.map((key) => {
    const match = existing.find((d) => d.distributor === key)
    return (
      match ?? {
        id: null,
        distributor: key,
        enabled: false,
        priority: 0,
        apiKey: "",
        clientId: "",
        clientSecret: "",
        partnerId: "",
        lastSyncedAt: null,
        lastTestStatus: null,
        lastTestedAt: null,
      }
    )
  })

  return NextResponse.json(result)
}