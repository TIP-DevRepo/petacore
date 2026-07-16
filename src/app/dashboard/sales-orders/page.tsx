"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface SalesOrder {
  id: string
  soNumber: string
  status: string
  clientPoNumber: string | null
  clientName: string
  owner: { id: string; name: string } | null
  total: number
  poCount: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  READY_TO_INVOICE: "bg-amber-100 text-amber-800",
  INVOICED: "bg-blue-100 text-blue-800",
  READY_TO_ORDER: "bg-purple-100 text-purple-800",
  PARTS_ORDERED: "bg-orange-100 text-orange-800",
  READY_TO_CLOSEOUT: "bg-teal-100 text-teal-800",
  CLOSED: "bg-green-100 text-green-800",
}

function statusLabel(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ")
}

export default function SalesOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    fetch("/api/sales-orders")
      .then((res) => res.json())
      .then((json) => {
        setOrders(json)
        setLoading(false)
      })
  }, [])

  const filtered = orders.filter((o) => {
    const matchesSearch =
      o.soNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.clientName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sales Orders</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by SO #, or client..."
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
          <option value="READY_TO_INVOICE">Ready to Invoice</option>
          <option value="INVOICED">Invoiced</option>
          <option value="READY_TO_ORDER">Ready to Order</option>
          <option value="PARTS_ORDERED">Parts Ordered</option>
          <option value="READY_TO_CLOSEOUT">Ready to Closeout</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-xs text-zinc-500">
              <th className="py-2 pr-3">SO Number</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Owner</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">POs</th>
              <th className="py-2 pr-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((so) => (
              <tr
                key={so.id}
                onClick={() => router.push(`/dashboard/sales-orders/${so.id}`)}
                className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
              >
                <td className="py-3 pr-3 font-medium">{so.soNumber}</td>
                <td className="py-3 pr-3">{so.clientName}</td>
                <td className="py-3 pr-3">{so.owner?.name ?? "—"}</td>
                <td className="py-3 pr-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[so.status]}`}>
                    {statusLabel(so.status)}
                  </span>
                </td>
                <td className="py-3 pr-3">${so.total.toFixed(2)}</td>
                <td className="py-3 pr-3">{so.poCount}</td>
                <td className="py-3 pr-3">{new Date(so.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-500">
                  No Sales Orders found. They&apos;re created automatically when a quote is accepted.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}