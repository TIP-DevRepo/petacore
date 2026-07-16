"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface PurchaseOrder {
  id: string
  poNumber: string
  status: string
  vendorName: string
  ownerName: string
  soNumber: string | null
  total: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  PARTS_ORDERED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  BACKORDERED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-red-100 text-red-800",
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ")
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    fetch("/api/purchase-orders")
      .then((res) => res.json())
      .then((json) => {
        setOrders(json)
        setLoading(false)
      })
  }, [])

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.vendorName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by PO #, or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PARTS_ORDERED">Parts Ordered</option>
          <option value="RECEIVED">Received</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="BACKORDERED">Backordered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-xs text-zinc-500">
              <th className="py-2 pr-3">PO Number</th>
              <th className="py-2 pr-3">Vendor</th>
              <th className="py-2 pr-3">Owner</th>
              <th className="py-2 pr-3">From SO</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((po) => (
              <tr
                key={po.id}
                onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
              >
                <td className="py-3 pr-3 font-medium">{po.poNumber}</td>
                <td className="py-3 pr-3">{po.vendorName}</td>
                <td className="py-3 pr-3">{po.ownerName}</td>
                <td className="py-3 pr-3">{po.soNumber ?? "—"}</td>
                <td className="py-3 pr-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[po.status]}`}>
                    {statusLabel(po.status)}
                  </span>
                </td>
                <td className="py-3 pr-3">${po.total.toFixed(2)}</td>
                <td className="py-3 pr-3">{new Date(po.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-500">
                  No Purchase Orders yet. Generate one from a Sales Order.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}