"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────
interface ClientOption {
  id: string
  name: string
}

interface ContactOption {
  id: string
  firstName: string
  lastName: string
}

interface UserOption {
  id: string
  name: string
  active: boolean
}

interface Template {
  id: string
  name: string
  introText: string | null
  terms: string | null
  expiryDays: number
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Page wrapper (Suspense required for useSearchParams) ──────────────────
export default function NewQuotePage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading...</p>}>
      <NewQuoteForm />
    </Suspense>
  )
}

function NewQuoteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("template")

  const [clients, setClients] = useState<ClientOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [template, setTemplate] = useState<Template | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    clientId: "",
    contactId: "",
    userId: "",
    title: "",
    introText: "",
    clientPoNumber: "",
    internalNotes: "",
    expiresAt: addDaysIso(30),
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Load clients + users on mount, redirect to the template picker if no template was chosen
  useEffect(() => {
    if (!templateId) {
      router.replace("/dashboard/quotes")
      return
    }

    fetch("/api/clients")
      .then((res) => res.json())
      .then(setClients)

    fetch("/api/users")
      .then((res) => res.json())
      .then((all: UserOption[]) => setUsers(all.filter((u) => u.active)))

    fetch(`/api/quote-templates/${templateId}`)
      .then((res) => res.json())
      .then((t: Template) => {
        setTemplate(t)
        setForm((prev) => ({
          ...prev,
          introText: t.introText || "",
          expiresAt: addDaysIso(t.expiryDays || 30),
        }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  // Load contacts whenever the selected client changes
  useEffect(() => {
    if (!form.clientId) {
      setContacts([])
      return
    }
    fetch(`/api/clients/${form.clientId}`)
      .then((res) => res.json())
      .then((client) => setContacts(client.contacts || []))
  }, [form.clientId])

  async function handleSave() {
    if (!form.clientId) {
      setError("Please select a client.")
      return
    }

    setSaving(true)
    setError("")

    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, templateId }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Something went wrong creating this quote.")
      setSaving(false)
      return
    }

    const quote = await res.json()
    router.push(`/dashboard/quotes/${quote.id}`)
  }

  return (
    <div className="w-full space-y-6:">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Quote</h1>
        {template && (
          <span className="text-sm text-zinc-500">Template: {template.name}</span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950">
          {error}
        </div>
      )}

      <div className="rounded-md border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Client & Contact</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Client *</label>
            <select
              value={form.clientId}
              onChange={(e) => update("clientId", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contact</label>
            <select
              value={form.contactId}
              onChange={(e) => update("contactId", e.target.value)}
              disabled={!form.clientId}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">No contact selected</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Quote Details</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Title / Subject</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Q3 Network Upgrade"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Quote Date</label>
            <input
              type="date"
              value={todayIso()}
              disabled
              className="w-full rounded-md border px-3 py-2 text-sm opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Expiry Date</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => update("expiresAt", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Assigned Rep</label>
            <select
              value={form.userId}
              onChange={(e) => update("userId", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Me (default)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Client PO # (optional)</label>
          <input
            type="text"
            value={form.clientPoNumber}
            onChange={(e) => update("clientPoNumber", e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Client-Facing Intro Message</label>
          <textarea
            value={form.introText}
            onChange={(e) => update("introText", e.target.value)}
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Internal Notes</label>
          <textarea
            value={form.internalNotes}
            onChange={(e) => update("internalNotes", e.target.value)}
            rows={2}
            placeholder="Not visible to the client"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/dashboard/quotes")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Quote"}
        </Button>
      </div>
    </div>
  )
}