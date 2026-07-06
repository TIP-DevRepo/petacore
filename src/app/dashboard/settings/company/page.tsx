"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface CompanyData {
  name: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
}

export default function CompanyBrandingPage() {
  const [data, setData] = useState<CompanyData>({
    name: "",
    logoUrl: null,
    primaryColor: "#1B3A5C",
    accentColor: "#2E86AB",
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/company-settings")
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage("")

    // Upload logo first, if a new one was picked
    if (logoFile) {
      const formData = new FormData()
      formData.append("file", logoFile)
      const res = await fetch("/api/company-settings/logo", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      data.logoUrl = json.logoUrl
    }

    // Save the rest of the fields
    await fetch("/api/company-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        primaryColor: data.primaryColor,
        accentColor: data.accentColor,
      }),
    })

    setSaving(false)
    setMessage("Saved successfully.")
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Company & Branding</h1>

      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Company Name</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium mb-1">Logo</label>
        {data.logoUrl && (
          <img
            src={data.logoUrl}
            alt="Company logo"
            className="h-16 mb-2 rounded border"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </div>

      {/* Primary Color */}
      <div>
        <label className="block text-sm font-medium mb-1">Primary Color</label>
        <input
          type="color"
          value={data.primaryColor}
          onChange={(e) => setData({ ...data, primaryColor: e.target.value })}
          className="h-10 w-20 rounded border"
        />
      </div>

      {/* Accent Color */}
      <div>
        <label className="block text-sm font-medium mb-1">Accent Color</label>
        <input
          type="color"
          value={data.accentColor}
          onChange={(e) => setData({ ...data, accentColor: e.target.value })}
          className="h-10 w-20 rounded border"
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  )
}