"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface CatalogItem {
  id: string
  name: string
  sku: string | null
  category: string | null
  type: string
  msrp: number
  cost: number
  taxable: boolean
  active: boolean
}

export default function CatalogListPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")

  useEffect(() => {
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((json) => {
        setItems(json)
        setLoading(false)
      })
  }, [])

  const categories = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean))
  ) as string[]

  const filtered = items.filter((i) => {
    const matchesSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku ?? "").toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "ALL" || i.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <Link href="/dashboard/catalog/new">
          <Button>Add Item</Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="ALL">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">SKU</th>
            <th className="py-2">Category</th>
            <th className="py-2">Type</th>
            <th className="py-2">Cost</th>
            <th className="py-2">MSRP</th>
            <th className="py-2">Taxable</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="py-2">
                <Link href={`/dashboard/catalog/${item.id}`} className="font-medium hover:underline">
                  {item.name}
                </Link>
              </td>
              <td className="py-2">{item.sku ?? "—"}</td>
              <td className="py-2">{item.category ?? "—"}</td>
              <td className="py-2">{item.type}</td>
              <td className="py-2">${item.cost.toFixed(2)}</td>
              <td className="py-2">${item.msrp.toFixed(2)}</td>
              <td className="py-2">{item.taxable ? "Yes" : "No"}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  item.active ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"
                }`}>
                  {item.active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-zinc-500">
                No catalog items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}