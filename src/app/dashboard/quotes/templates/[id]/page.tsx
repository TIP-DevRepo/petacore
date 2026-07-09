"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface TemplateLineItem {
  id: string
  name: string
  quantity: number
  discount: number
}

interface TemplateDetail {
  id: string
  name: string
  description: string | null
  introText: string | null
  terms: string | null
  expiryDays: number
  active: boolean
  lineItems: TemplateLineItem[]
}

export default function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [id, setId] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return
    fetch(`/api/quote-templates/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) setTemplate(data)
        setLoading(false)
      })
  }, [id])

  function update(field: string, value: string | number | boolean) {
    setTemplate((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  async function handleSave() {
    if (!id || !template) return
    setSaving(true)
    await fetch(`/api/quote-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        introText: template.introText,
        terms: template.terms,
        expiryDays: template.expiryDays,
        active: template.active,
      }),
    })
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>
  if (notFound || !template) return <p className="text-sm text-red-600">Template not found.</p>

  return (
    <div className="max-w-xl space-y-6">
      <Link href="/dashboard/quotes" className="text-sm text-zinc-500 hover:underline">
        ← Back to Quotes
      </Link>

      <h1 className="text-2xl font-bold">{template.name}</h1>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Template Name</label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={template.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Intro Text</label>
          <textarea
            value={template.introText ?? ""}
            onChange={(e) => update("introText", e.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Terms & Conditions</label>
          <textarea
            value={template.terms ?? ""}
            onChange={(e) => update("terms", e.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Expiry (days)</label>
          <input
            type="number"
            value={template.expiryDays}
            onChange={(e) => update("expiryDays", Number(e.target.value))}
            className="w-32 rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={template.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          Active (available when starting a new quote)
        </label>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="rounded-md border p-4">
        <h2 className="font-semibold text-sm mb-2">Line Items ({template.lineItems.length})</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Full line item editing (sections, recurring, optional items, bundles, etc.) for
          templates is coming in a dedicated template builder pass.
        </p>
        {template.lineItems.map((li) => (
          <div key={li.id} className="flex justify-between border-b py-1 last:border-0 text-sm">
            <span>{li.name}</span>
            <span className="text-zinc-500">
              Qty {li.quantity}{li.discount > 0 ? ` · ${li.discount}% off` : ""}
            </span>
          </div>
        ))}
        {template.lineItems.length === 0 && (
          <p className="text-sm text-zinc-500">No line items on this template.</p>
        )}
      </div>
    </div>
  )
}