"use client"

import { useState, useEffect, useCallback, use } from "react"

const pdfButtonStyle = `
  .pdf-download-btn {
    flex-shrink: 0;
    border-radius: 6px;
    border: 1px solid #d4d4d8;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    background: white;
    white-space: nowrap;
    text-decoration: none;
    color: inherit;
  }
  .pdf-download-btn:hover {
    background: #fafafa;
  }
`

type RecurringInterval = "MONTHLY" | "QUARTERLY" | "ANNUALLY"

interface LineItem {
  id: string
  section: string | null
  sortOrder: number
  name: string
  description: string | null
  sku: string | null
  quantity: number
  unitPrice: number
  discount: number
  taxable: boolean
  isRecurring: boolean
  recurringInterval: RecurringInterval | null
  isOptional: boolean
  optionalSelected: boolean
}

interface PortalQuote {
  id: string
  quoteNumber: string
  version: number
  status: string
  title: string | null
  introText: string | null
  terms: string | null
  clientPoNumber: string | null
  expiresAt: string | null
  taxRate: number
  declineReason: string | null
  portalComment: string | null
  client: { name: string }
  contact: { firstName: string; lastName: string } | null
  user: { name: string; email: string }
  company: {
    name: string
    logoUrl: string | null
    settings: { primaryColor: string; accentColor: string } | null
  }
  lineItems: LineItem[]
}

const NO_SECTION = "__no_section__"

function lineTotal(li: LineItem) {
  return li.unitPrice * li.quantity * (1 - li.discount / 100)
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SENT: { label: "Awaiting Your Review", color: "bg-blue-100 text-blue-700" },
  VIEWED: { label: "Awaiting Your Review", color: "bg-blue-100 text-blue-700" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700" },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700" },
  EXPIRED: { label: "Expired", color: "bg-zinc-200 text-zinc-600" },
  DRAFT: { label: "Draft Preview", color: "bg-amber-100 text-amber-700" },
}

export default function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [quote, setQuote] = useState<PortalQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState("")

  const load = useCallback(() => {
    fetch(`/api/portal/${token}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) setQuote(data)
        setLoading(false)
      })
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="p-10 text-center text-zinc-500">Loading your quote...</div>
  if (notFound || !quote)
    return <div className="p-10 text-center text-zinc-500">This quote link is invalid or no longer available.</div>

  const primary = quote.company.settings?.primaryColor ?? "#1B3A5C"
  const accent = quote.company.settings?.accentColor ?? "#2E86AB"
  const statusMeta = STATUS_LABELS[quote.status] ?? { label: quote.status, color: "bg-zinc-100 text-zinc-600" }
  const isLocked = quote.status === "ACCEPTED" || quote.status === "DECLINED" || quote.status === "EXPIRED"

  async function toggleOptional(li: LineItem) {
    setQuote((prev) =>
      prev
        ? {
            ...prev,
            lineItems: prev.lineItems.map((x) =>
              x.id === li.id ? { ...x, optionalSelected: !x.optionalSelected } : x
            ),
          }
        : prev
    )
    await fetch(`/api/portal/${token}/line-items/${li.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionalSelected: !li.optionalSelected }),
    })
  }

  async function handleAccept() {
    setSubmitting(true)
    const res = await fetch(`/api/portal/${token}/accept`, { method: "POST" })
    if (res.ok) {
      setActionMessage("Thank you — this quote has been accepted.")
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setActionMessage(data.error || "Something went wrong.")
    }
    setSubmitting(false)
  }

  async function handleDecline() {
    setSubmitting(true)
    const res = await fetch(`/api/portal/${token}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: declineReason }),
    })
    if (res.ok) {
      setActionMessage("This quote has been declined.")
      setShowDeclineForm(false)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setActionMessage(data.error || "Something went wrong.")
    }
    setSubmitting(false)
  }

  async function handleComment() {
    if (!comment.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/portal/${token}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    })
    if (res.ok) {
      setComment("")
      setActionMessage("Your comment has been sent.")
      load()
    }
    setSubmitting(false)
  }

  // ─── Sections ────────────────────────────────────────────────────────────
  const sectionKeys: string[] = []
  quote.lineItems
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((li) => {
      const key = li.section ?? NO_SECTION
      if (!sectionKeys.includes(key)) sectionKeys.push(key)
    })

  // ─── Totals (client view — only counted items) ──────────────────────────
  const countedItems = quote.lineItems.filter((li) => !li.isOptional || li.optionalSelected)
  const oneTime = countedItems.filter((li) => !li.isRecurring)
  const oneTimeSubtotal = oneTime.reduce((sum, li) => sum + lineTotal(li), 0)
  const taxableOneTime = oneTime.filter((li) => li.taxable).reduce((s, li) => s + lineTotal(li), 0)
  const tax = taxableOneTime * (quote.taxRate / 100)
  const grandTotalOneTime = oneTimeSubtotal + tax

  const recurringByInterval: Record<RecurringInterval, number> = {
    MONTHLY: 0,
    QUARTERLY: 0,
    ANNUALLY: 0,
  }
  countedItems
    .filter((li) => li.isRecurring && li.recurringInterval)
    .forEach((li) => {
      recurringByInterval[li.recurringInterval as RecurringInterval] += lineTotal(li)
    })

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Branded header */}
      <div style={{ backgroundColor: primary }} className="text-white">
        <div className="max-w-3xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {quote.company.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={quote.company.logoUrl} alt={quote.company.name} className="h-10 w-auto" />
            )}
            <span className="text-lg font-semibold">{quote.company.name}</span>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>
      </div>

      <style>{pdfButtonStyle}</style>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {quote.quoteNumber}
              {quote.version > 1 && (
                <span className="text-base font-normal text-zinc-400"> v{quote.version}</span>
              )}
            </h1>
            {quote.title && <p className="text-zinc-600">{quote.title}</p>}
            <p className="text-sm text-zinc-500 mt-1">
              Prepared for {quote.client.name}
              {quote.contact ? ` — ${quote.contact.firstName} ${quote.contact.lastName}` : ""} by{" "}
              {quote.user.name}
            </p>
            {quote.expiresAt && (
              <p className="text-sm text-zinc-500">
                Valid until {new Date(quote.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          
            <a href={`/api/portal/${token}/pdf`} target="_blank" rel="noopener noreferrer" className="pdf-download-btn">
            Download PDF
          </a>
        </div>

        {quote.introText && (
          <div className="rounded-md border bg-white p-4 text-sm whitespace-pre-wrap">
            {quote.introText}
          </div>
        )}

        {/* Line items */}
        <div className="space-y-4">
          {sectionKeys.map((sectionKey) => {
            const items = quote.lineItems
              .filter((li) => (li.section ?? NO_SECTION) === sectionKey)
              .sort((a, b) => a.sortOrder - b.sortOrder)

            return (
              <div key={sectionKey} className="rounded-md border bg-white overflow-hidden">
                <div
                  className="px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: accent }}
                >
                  {sectionKey === NO_SECTION ? "Items" : sectionKey}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((li) => (
                      <tr key={li.id} className="border-b last:border-0">
                        <td className="py-3 pl-4 pr-2 w-8">
                          {li.isOptional && !isLocked && (
                            <input
                              type="checkbox"
                              checked={li.optionalSelected}
                              onChange={() => toggleOptional(li)}
                            />
                          )}
                        </td>
                        <td className="py-3 pr-2">
                          <p className="font-medium">
                            {li.name}
                            {li.isOptional && (
                              <span className="ml-2 text-xs text-zinc-400">(optional)</span>
                            )}
                          </p>
                          {li.description && (
                            <p className="text-xs text-zinc-500">{li.description}</p>
                          )}
                          {li.isRecurring && (
                            <p className="text-xs text-zinc-400">
                              Recurring — {li.recurringInterval?.toLowerCase()}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-2 text-right text-zinc-500 whitespace-nowrap">
                          {li.quantity} × {money(li.unitPrice)}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">
                          {li.isOptional && !li.optionalSelected ? (
                            <span className="text-zinc-400">Not included</span>
                          ) : (
                            money(lineTotal(li))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>

        {/* Totals */}
        <div className="rounded-md border bg-white p-4 space-y-1 text-sm max-w-md ml-auto">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>{money(oneTimeSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax ({quote.taxRate}%)</span>
            <span>{money(tax)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Total (One-Time)</span>
            <span>{money(grandTotalOneTime)}</span>
          </div>
          {recurringByInterval.MONTHLY > 0 && (
            <div className="flex justify-between pt-2">
              <span className="text-zinc-500">Monthly</span>
              <span>{money(recurringByInterval.MONTHLY)}</span>
            </div>
          )}
          {recurringByInterval.QUARTERLY > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Quarterly</span>
              <span>{money(recurringByInterval.QUARTERLY)}</span>
            </div>
          )}
          {recurringByInterval.ANNUALLY > 0 && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Annual</span>
              <span>{money(recurringByInterval.ANNUALLY)}</span>
            </div>
          )}
        </div>

        {quote.terms && (
          <div className="rounded-md border bg-white p-4 text-xs text-zinc-500 whitespace-pre-wrap">
            <p className="font-medium text-zinc-700 mb-1">Terms & Conditions</p>
            {quote.terms}
          </div>
        )}

        {/* Actions */}
        {actionMessage && (
          <div className="rounded-md border bg-white p-3 text-sm text-center">{actionMessage}</div>
        )}

        {!isLocked && (
          <div className="rounded-md border bg-white p-4 space-y-3">
            {!showDeclineForm ? (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  style={{ backgroundColor: primary }}
                  className="rounded-md px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Accept Quote
                </button>
                <button
                  onClick={() => setShowDeclineForm(true)}
                  disabled={submitting}
                  className="rounded-md border px-6 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Let us know why (optional)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowDeclineForm(false)}
                    className="rounded-md border px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={submitting}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Confirm Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isLocked && quote.status === "DECLINED" && quote.declineReason && (
          <div className="rounded-md border bg-white p-4 text-sm">
            <p className="font-medium mb-1">Decline reason</p>
            <p className="text-zinc-600">{quote.declineReason}</p>
          </div>
        )}

        {/* Comment box */}
        <div className="rounded-md border bg-white p-4 space-y-2">
          <label className="block text-sm font-medium">Have a question or comment?</label>
          {quote.portalComment && (
            <p className="text-xs text-zinc-500 border rounded p-2 bg-zinc-50">
              You previously sent: "{quote.portalComment}"
            </p>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Type your message here..."
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <button
              onClick={handleComment}
              disabled={submitting || !comment.trim()}
              className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            >
              Send Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}