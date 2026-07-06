"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  industry: string | null
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PROSPECT: "bg-blue-100 text-blue-800",
  INACTIVE: "bg-zinc-100 text-zinc-600",
  LOST: "bg-red-100 text-red-800",
}

export default function ClientsListPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((json) => {
        setClients(json)
        setLoading(false)
      })
  }, [])

  const filtered = clients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/dashboard/clients/new">
          <Button>Add Client</Button>
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PROSPECT">Prospect</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOST">Lost</option>
        </select>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Industry</th>
            <th className="py-2">Email</th>
            <th className="py-2">Phone</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((client) => (
            <tr key={client.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="py-2">
                <Link href={`/dashboard/clients/${client.id}`} className="font-medium hover:underline">
                  {client.name}
                </Link>
              </td>
              <td className="py-2">{client.industry ?? "—"}</td>
              <td className="py-2">{client.email ?? "—"}</td>
              <td className="py-2">{client.phone ?? "—"}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[client.status]}`}>
                  {client.status}
                </span>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-500">
                No clients found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}