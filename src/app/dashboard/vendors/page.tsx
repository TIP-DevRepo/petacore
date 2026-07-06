"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Vendor {
  id: string
  name: string
  type: string
  status: string
  email: string | null
  phone: string | null
  isDistributor: boolean
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-zinc-100 text-zinc-600",
  PREFERRED: "bg-blue-100 text-blue-800",
}

export default function VendorsListPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")

  useEffect(() => {
    fetch("/api/vendors")
      .then((res) => res.json())
      .then((json) => {
        setVendors(json)
        setLoading(false)
      })
  }, [])

  const filtered = vendors.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === "ALL" || v.type === typeFilter
    return matchesSearch && matchesType
  })

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <Link href="/dashboard/vendors/new">
          <Button>Add Vendor</Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="ALL">All Types</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="SUBCONTRACTOR">Subcontractor</option>
          <option value="PARTNER">Partner</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Type</th>
            <th className="py-2">Email</th>
            <th className="py-2">Phone</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((vendor) => (
            <tr key={vendor.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="py-2">
                <Link href={`/dashboard/vendors/${vendor.id}`} className="font-medium hover:underline">
                  {vendor.name}
                </Link>
                {vendor.isDistributor && (
                  <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                    Distributor
                  </span>
                )}
              </td>
              <td className="py-2">{vendor.type}</td>
              <td className="py-2">{vendor.email ?? "—"}</td>
              <td className="py-2">{vendor.phone ?? "—"}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[vendor.status]}`}>
                  {vendor.status}
                </span>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-500">
                No vendors found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}