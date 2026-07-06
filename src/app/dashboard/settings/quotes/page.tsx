"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface QuoteSettings {
  quotePrefix: string
  quoteExpiryDays: number
  quoteTerms: string
  quoteDefaultCc: string
  quoteApprovalThreshold: number | null
}

export default function QuoteSettingsPage() {
  const [settings, setSettings] = useState<QuoteSettings>({
    quotePrefix: "Q",
    quoteExpiryDays: 30,
    quoteTerms: "",
    quoteDefaultCc: "",
    quoteApprovalThreshold: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/quote-settings")
      .then((res) => res.json())
      .then((json) => {
        setSettings(json)
        setLoading(false)
      })
  }, [])

  function update(field: string, value: string | number | null) {
    setSettings({ ...settings, [field]: value })
  }

  async function handleSave() {
    setSaving(true)
    setMessage("")

    await fetch("/api/quote-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })

    setSaving(false)
    setMessage("Saved successfully.")
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Quote Settings</h1>

      <div className="rounded-md border p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Quote Number Prefix</label>
          <input
            type="text"
            value={settings.quotePrefix}
            onChange={(e) => update("quotePrefix", e.target.value)}
            className="w-32 rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Example: with prefix "{settings.quotePrefix}", quotes will be numbered {settings.quotePrefix}-00001, {settings.quotePrefix}-00002, etc.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Expiry (days)</label>
          <input
            type="number"
            value={settings.quoteExpiryDays}
            onChange={(e) => update("quoteExpiryDays", Number(e.target.value))}
            className="w-32 rounded-md border px-3 py-2 text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">
            New quotes will automatically expire this many days after being sent, unless overridden.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default Terms & Conditions</label>
          <textarea
            value={settings.quoteTerms}
            onChange={(e) => update("quoteTerms", e.target.value)}
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="This text will appear at the bottom of every quote by default."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Default CC Email</label>
          <input
            type="email"
            value={settings.quoteDefaultCc}
            onChange={(e) => update("quoteDefaultCc", e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. sales@tipinc.com"
          />
          <p className="text-xs text-zinc-500 mt-1">
            This address will be automatically CC'd whenever a quote is sent.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Manager Approval Threshold ($)</label>
          <input
            type="number"
            value={settings.quoteApprovalThreshold ?? ""}
            onChange={(e) => update("quoteApprovalThreshold", e.target.value ? Number(e.target.value) : null)}
            className="w-40 rounded-md border px-3 py-2 text-sm"
            placeholder="Leave blank to disable"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Quotes totaling more than this amount will require manager approval before sending. Leave blank to turn this off.
          </p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>

      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  )
}