import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { loadEnvFile } from "process"

loadEnvFile(".env")

const EMAILS_TO_REMOVE = ["test@tipinc.com", "jputiyon@tipinc.ai"]
const REASSIGN_TO_EMAIL = "admin@tipinc.com"

async function main() {
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

  const reassignTo = await prisma.user.findUnique({ where: { email: REASSIGN_TO_EMAIL } })
  if (!reassignTo) {
    console.error(`Reassignment target ${REASSIGN_TO_EMAIL} not found — aborting.`)
    await prisma.$disconnect()
    await pool.end()
    return
  }

  for (const email of EMAILS_TO_REMOVE) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { quotes: true, salesOrders: true, purchaseOrders: true },
    })

    if (!user) {
      console.log(`No user found for ${email} — skipping`)
      continue
    }

    if (user.quotes.length > 0) {
      await prisma.quote.updateMany({
        where: { userId: user.id },
        data: { userId: reassignTo.id },
      })
      console.log(`  Reassigned ${user.quotes.length} quote(s) from ${email} to ${REASSIGN_TO_EMAIL}`)
    }
    if (user.salesOrders.length > 0) {
      await prisma.salesOrder.updateMany({
        where: { userId: user.id },
        data: { userId: reassignTo.id },
      })
      console.log(`  Reassigned ${user.salesOrders.length} sales order(s) from ${email} to ${REASSIGN_TO_EMAIL}`)
    }
    if (user.purchaseOrders.length > 0) {
      await prisma.purchaseOrder.updateMany({
        where: { userId: user.id },
        data: { userId: reassignTo.id },
      })
      console.log(`  Reassigned ${user.purchaseOrders.length} purchase order(s) from ${email} to ${REASSIGN_TO_EMAIL}`)
    }

    await prisma.user.delete({ where: { id: user.id } })
    console.log(`Deleted ${email}`)
  }

  console.log("\nDone.")
  await prisma.$disconnect()
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})