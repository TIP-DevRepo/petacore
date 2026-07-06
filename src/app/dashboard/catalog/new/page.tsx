"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function NewCatalogItemPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    name: "",
    description: "",
    sku: "",
    category: "",
    subcategory: "",
    type: "PHYSICAL",
    msrp: "",
    cost: "",
    unit: "each",
    taxable: true,
    active: true,
  })

  function update(field: string, value: string | boolean) {
    setForm({ ...form, [field]: value })
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Item name is required.")
      return
    }

    setSaving(true)
    setError("")

    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      setError("Something went wrong saving this item.")
      setSaving(false)
      return
    }

    const item = await res.json()
    router.push(`/dashboard/catalog/${item.id}`)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add Catalog Item</h1>

      <div className="rounded-md border p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Item Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={2}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => update("sku", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="PHYSICAL">Physical</option>
              <option value="SERVICE">Service</option>
              <option value="SUBSCRIPTION">Subscription</option>
              <option value="BUNDLE">Bundle</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              placeholder="e.g. Networking"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subcategory</label>
            <input
              type="text"
              placeholder="e.g. Switches"
              value={form.subcategory}
              onChange={(e) => update("subcategory", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cost Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.cost}
              onChange={(e) => update("cost", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MSRP ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.msrp}
              onChange={(e) => update("msrp", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Unit</label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => update("unit", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.taxable}
              onChange={(e) => update("taxable", e.target.checked)}
            />
            Taxable
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Active
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Item"}
      </Button>
    </div>
  )
}