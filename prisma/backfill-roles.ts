import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { loadEnvFile } from "process"

loadEnvFile(".env")

// The 5 starter roles, in rank order (higher rank = more senior). These
// match your original UserRole enum exactly, with a starter permission set
// that mirrors current behavior as closely as possible — ADMIN gets
// everything, VIEWER gets read-only page access with no action permissions.
const STARTER_ROLES = [
  {
    name: "Admin",
    rank: 100,
    permissions: {
      pages: { clients: true, catalog: true, vendors: true, quotes: true, settings: true },
      quotes: { create: true, edit: true, delete: true, changeStatus: true, approve: true, sendEmail: true, viewAllUsersQuotes: true },
      clients: { create: true, edit: true, delete: true, viewAllClients: true },
      settingsSections: { company: true, users: true, quotes: true, approvalWorkflows: true, notifications: true, integrations: true },
      maxDiscount: 100,
    },
  },
  {
    name: "Manager",
    rank: 75,
    permissions: {
      pages: { clients: true, catalog: true, vendors: true, quotes: true, settings: true },
      quotes: { create: true, edit: true, delete: true, changeStatus: true, approve: true, sendEmail: true, viewAllUsersQuotes: true },
      clients: { create: true, edit: true, delete: true, viewAllClients: true },
      settingsSections: { company: false, users: true, quotes: true, approvalWorkflows: true, notifications: false, integrations: false },
      maxDiscount: 25,
    },
  },
  {
    name: "Rep",
    rank: 50,
    permissions: {
      pages: { clients: true, catalog: true, vendors: false, quotes: true, settings: false },
      quotes: { create: true, edit: true, delete: false, changeStatus: false, approve: false, sendEmail: true, viewAllUsersQuotes: false },
      clients: { create: true, edit: true, delete: false, viewAllClients: false },
      settingsSections: { company: false, users: false, quotes: false, approvalWorkflows: false, notifications: false, integrations: false },
      maxDiscount: 10,
    },
  },
  {
    name: "Estimator",
    rank: 50,
    permissions: {
      pages: { clients: true, catalog: true, vendors: false, quotes: true, settings: false },
      quotes: { create: true, edit: true, delete: false, changeStatus: false, approve: false, sendEmail: false, viewAllUsersQuotes: false },
      clients: { create: false, edit: false, delete: false, viewAllClients: false },
      settingsSections: { company: false, users: false, quotes: false, approvalWorkflows: false, notifications: false, integrations: false },
      maxDiscount: 10,
    },
  },
  {
    name: "Viewer",
    rank: 10,
    permissions: {
      pages: { clients: true, catalog: true, vendors: false, quotes: true, settings: false },
      quotes: { create: false, edit: false, delete: false, changeStatus: false, approve: false, sendEmail: false, viewAllUsersQuotes: false },
      clients: { create: false, edit: false, delete: false, viewAllClients: false },
      settingsSections: { company: false, users: false, quotes: false, approvalWorkflows: false, notifications: false, integrations: false },
      maxDiscount: 0,
    },
  },
]

// Known-good mapping decided directly with Louis, since the original role
// column was already dropped before this script was written
const USER_ROLE_ASSIGNMENTS: Record<string, string> = {
  "admin@tipinc.com": "Admin",
}

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

  const companies = await prisma.company.findMany()

  for (const company of companies) {
    console.log(`\nCompany: ${company.name}`)

    const roleIdByName: Record<string, string> = {}

    for (const starter of STARTER_ROLES) {
      const role = await prisma.role.upsert({
        where: { companyId_name: { companyId: company.id, name: starter.name } },
        update: {},
        create: {
          companyId: company.id,
          name: starter.name,
          rank: starter.rank,
          permissions: starter.permissions,
          isSystem: true,
        },
      })
      roleIdByName[starter.name] = role.id
      console.log(`  Created/found role: ${starter.name}`)
    }

    const users = await prisma.user.findMany({ where: { companyId: company.id } })
    for (const user of users) {
      const roleName = USER_ROLE_ASSIGNMENTS[user.email]
      if (!roleName) {
        console.log(`  ⚠ No role mapping for ${user.email} — left unassigned, set manually after this runs`)
        continue
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: roleIdByName[roleName] },
      })
      console.log(`  Assigned ${user.email} -> ${roleName}`)
    }
  }

  console.log("\nBackfill complete.")
  await prisma.$disconnect()
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})