"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface VendorDetail {
  id: string
  name: string
  type: string
  status: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  paymentTerms: string | null
  leadTimeDays: number | null
  notes: string | null
  isDistributor: boolean
}

export default function VendorDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/vendors/${id}`)
      .then((res) => res.json())
      .then((json) => {
        setVendor(json)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  if (!vendor) {
    return <p className="text-sm text-red-600">Vendor not found.</p>
  }

  return (
    <div className="w-full space-y-6:">
      <div>
        <Link href="/dashboard/vendors" className="text-sm text-zinc-500 hover:underline inline-block mb-2">
          ← Back to Vendors
        </Link>
        <h1 className="text-2xl font-bold">
          {vendor.name}
          {vendor.isDistributor && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800 align-middle">
              Distributor
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">{vendor.type} · {vendor.status}</p>
      </div>

      <div className="rounded-md border p-4 space-y-2 text-sm">
        <p><span className="font-medium">Email:</span> {vendor.email ?? "—"}</p>
        <p><span className="font-medium">Phone:</span> {vendor.phone ?? "—"}</p>
        <p><span className="font-medium">Website:</span> {vendor.website ?? "—"}</p>
        <p><span className="font-medium">Address:</span> {vendor.address ?? "—"}</p>
        <p><span className="font-medium">Payment Terms:</span> {vendor.paymentTerms ?? "—"}</p>
        <p><span className="font-medium">Lead Time:</span> {vendor.leadTimeDays ? `${vendor.leadTimeDays} days` : "—"}</p>
      </div>

      {vendor.notes && (
        <div className="rounded-md border p-4 text-sm">
          <h3 className="font-semibold mb-1">Notes</h3>
          <p>{vendor.notes}</p>
        </div>
      )}
    </div>
  )
}