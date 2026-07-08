"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────
interface Quote {
  id: string
  quoteNumber: string
  version: number
  status: string
  clientName: string
  total: number
  createdAt: string
  expiresAt: string | null
  draftVersionId: string | null
  draftVersionNumber: number | null
}

interface Scorecard {
  totalQuotes: number
  counts: Record<string, number>
  totalValue: number
  acceptedValue: number
}

interface Template {
  id: string
  name: string
  description: string | null
  expiryDays: number
  active: boolean
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function QuotesPage() {
  const [activeTab, setActiveTab] = useState<"scorecard" | "quotes" | "templates">("quotes")
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Button onClick={() => setShowTemplatePicker(true)}>New Quote</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b text-sm">
        <button
          onClick={() => setActiveTab("scorecard")}
          className={`pb-2 ${activeTab === "scorecard" ? "border-b-2 border-zinc-900 font-semibold dark:border-zinc-100" : "text-zinc-500"}`}
        >
          Scorecard
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          className={`pb-2 ${activeTab === "quotes" ? "border-b-2 border-zinc-900 font-semibold dark:border-zinc-100" : "text-zinc-500"}`}
        >
          Quotes
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-2 ${activeTab === "templates" ? "border-b-2 border-zinc-900 font-semibold dark:border-zinc-100" : "text-zinc-500"}`}
        >
          Templates
        </button>
      </div>

      {activeTab === "scorecard" && <ScorecardTab />}
      {activeTab === "quotes" && <QuotesTab />}
      {activeTab === "templates" && <TemplatesTab />}

      {showTemplatePicker && (
        <TemplatePickerModal onClose={() => setShowTemplatePicker(false)} />
      )}
    </div>
  )
}

// ─── Scorecard Tab ────────────────────────────────────────────────────────
function ScorecardTab() {
  const [data, setData] = useState<Scorecard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/quote-scorecard")
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>
  if (!data) return <p className="text-sm text-red-600">Could not load scorecard.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-md border p-4">
          <p className="text-xs text-zinc-500">Total Quotes</p>
          <p className="text-2xl font-bold">{data.totalQuotes}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-xs text-zinc-500">Total Value</p>
          <p className="text-2xl font-bold">${data.totalValue.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-xs text-zinc-500">Accepted Value</p>
          <p className="text-2xl font-bold">${data.acceptedValue.toFixed(2)}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-xs text-zinc-500">Accepted Quotes</p>
          <p className="text-2xl font-bold">{data.counts.ACCEPTED ?? 0}</p>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="font-semibold text-sm mb-3">By Status</h3>
        <div className="space-y-2">
          {Object.entries(data.counts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
                {status.replace("_", " ")}
              </span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Quotes Tab ───────────────────────────────────────────────────────────
function QuotesTab() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [openChoiceFor, setOpenChoiceFor] = useState<Quote | null>(null)

  useEffect(() => {
    fetch("/api/quotes")
      .then((res) => res.json())
      .then((json) => {
        setQuotes(json)
        setLoading(false)
      })
  }, [])

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.clientName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || q.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>

  function handleOpenQuote(quote: Quote) {
    if (quote.draftVersionId) {
      setOpenChoiceFor(quote)
    } else {
      router.push(`/dashboard/quotes/${quote.id}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by quote # or client..."
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
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="SENT">Sent</option>
          <option value="VIEWED">Viewed</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="DECLINED">Declined</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Quote #</th>
            <th className="py-2">Client</th>
            <th className="py-2">Total</th>
            <th className="py-2">Status</th>
            <th className="py-2">Created</th>
            <th className="py-2">Expires</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((quote) => (
            <tr key={quote.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="py-2">
                <button
                  onClick={() => handleOpenQuote(quote)}
                  className="font-medium hover:underline text-left"
                >
                  {quote.version > 1 ? `${quote.quoteNumber} v${quote.version}` : quote.quoteNumber}
                </button>
                {quote.draftVersionId && (
                  <span
                    title={`Version ${quote.draftVersionNumber} draft in progress`}
                    className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  >
                    Draft v{quote.draftVersionNumber} in progress
                  </span>
                )}
              </td>
              <td className="py-2">{quote.clientName}</td>
              <td className="py-2">${quote.total.toFixed(2)}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[quote.status]}`}>
                  {quote.status.replace("_", " ")}
                </span>
              </td>
              <td className="py-2">{new Date(quote.createdAt).toLocaleDateString()}</td>
              <td className="py-2">{quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-zinc-500">
                No quotes found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {openChoiceFor && (
        <OpenChoiceModal
          quote={openChoiceFor}
          onClose={() => setOpenChoiceFor(null)}
        />
      )}
    </div>
  )
}

// ─── Open Choice Modal (live version vs. draft in progress) ──────────────
function OpenChoiceModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-md p-6 w-full max-w-sm space-y-4">
        <h2 className="text-lg font-bold">
          {quote.quoteNumber} has a draft in progress
        </h2>
        <p className="text-sm text-zinc-500">
          Version {quote.version} is the current live quote. Version {quote.draftVersionNumber} is
          a draft revision that hasn&apos;t been sent yet. Which would you like to open?
        </p>
        <div className="space-y-2">
          <button
            onClick={() => router.push(`/dashboard/quotes/${quote.id}`)}
            className="w-full rounded-md border p-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <p className="font-medium">View Current Live Quote</p>
            <p className="text-xs text-zinc-500">v{quote.version} · {quote.status.replace("_", " ")}</p>
          </button>
          <button
            onClick={() => router.push(`/dashboard/quotes/${quote.draftVersionId}`)}
            className="w-full rounded-md border p-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <p className="font-medium">Work on New Version Draft</p>
            <p className="text-xs text-zinc-500">v{quote.draftVersionNumber} · Draft</p>
          </button>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Templates Tab ────────────────────────────────────────────────────────
function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    introText: "",
    terms: "",
    expiryDays: "30",
  })

  function loadTemplates() {
    fetch("/api/quote-templates")
      .then((res) => res.json())
      .then((json) => {
        setTemplates(json)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  async function handleCreate() {
    if (!newTemplate.name.trim()) return

    await fetch("/api/quote-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTemplate),
    })

    setNewTemplate({ name: "", description: "", introText: "", terms: "", expiryDays: "30" })
    setShowNew(false)
    loadTemplates()
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(!showNew)}>
          {showNew ? "Cancel" : "New Template"}
        </Button>
      </div>

      {showNew && (
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Template Name *</label>
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Intro Text</label>
            <textarea
              value={newTemplate.introText}
              onChange={(e) => setNewTemplate({ ...newTemplate, introText: e.target.value })}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Terms & Conditions</label>
            <textarea
              value={newTemplate.terms}
              onChange={(e) => setNewTemplate({ ...newTemplate, terms: e.target.value })}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Expiry (days)</label>
            <input
              type="number"
              value={newTemplate.expiryDays}
              onChange={(e) => setNewTemplate({ ...newTemplate, expiryDays: e.target.value })}
              className="w-32 rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <Button onClick={handleCreate}>Save Template</Button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{t.name}</p>
            {t.description && <p className="text-zinc-500">{t.description}</p>}
            <p className="text-zinc-500 text-xs mt-1">Expires after {t.expiryDays} days</p>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-zinc-500">No templates yet. Create one above.</p>
        )}
      </div>
    </div>
  )
}

// ─── New Quote Template Picker Modal ──────────────────────────────────────
function TemplatePickerModal({ onClose }: { onClose: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/quote-templates")
      .then((res) => res.json())
      .then((json) => {
        setTemplates(json.filter((t: Template) => t.active))
        setLoading(false)
      })
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-md p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Choose a Template</h2>

        {loading && <p className="text-sm text-zinc-500">Loading templates...</p>}

        {!loading && templates.length === 0 && (
          <p className="text-sm text-zinc-500">
            No templates yet. Go to the Templates tab to create one before starting a quote.
          </p>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/quotes/new?template=${t.id}`}
              className="block rounded-md border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <p className="font-medium">{t.name}</p>
              {t.description && <p className="text-zinc-500">{t.description}</p>}
            </Link>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}