"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Button as HeroButton } from "@heroui/react"
import {
  LineItemBuilder,
  type LineItemBuilderItem,
  type CatalogOption,
  type RecurringInterval,
} from "@/components/quotes/LineItemBuilder"
import { Modal } from "@/components/Modal"

// ─── Types ────────────────────────────────────────────────────────────────
interface QuoteDetail {
  id: string
  quoteNumber: string
  status: string
  title: string | null
  introText: string | null
  internalNotes: string | null
  clientPoNumber: string | null
  expiresAt: string | null
  createdAt: string
  taxRate: number
  accessToken: string
  version: number
  isActive: boolean
  client: { id: string; name: string; email: string | null }
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null
  user: { id: string; name: string }
  lineItems: LineItemBuilderItem[]
}

interface VersionSummary {
  id: string
  version: number
  status: string
  createdAt: string
  sentAt: string | null
  isActive: boolean
}

interface ApprovalRequirement {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  reason: string | null
  decidedAt: string | null
  workflow: {
    name: string
    triggerType: string
    requiredRole: { id: string; name: string; rank: number } | null
  }
  approvedByUser: { name: string } | null
}

interface Comment {
  id: string
  authorType: "INTERNAL" | "CLIENT"
  authorName: string
  message: string
  createdAt: string
}

interface MyRole {
  id: string
  name: string
  rank: number
  permissions: {
    quotes?: { changeStatus?: boolean; delete?: boolean; edit?: boolean }
  }
}

interface ClientOption {
  id: string
  name: string
}

interface ContactOption {
  id: string
  firstName: string
  lastName: string
}

function lineTotal(li: LineItemBuilderItem) {
  return li.unitPrice * li.quantity * (1 - li.discount / 100)
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

// Internal-facing display rename: Accepted -> Approved, Declined -> Lost
function statusLabel(status: string) {
  if (status === "ACCEPTED") return "Approved"
  if (status === "DECLINED") return "Lost"
  return status.replace("_", " ")
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [catalog, setCatalog] = useState<CatalogOption[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<ApprovalRequirement[]>([])
  const [myRole, setMyRole] = useState<MyRole | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [postingComment, setPostingComment] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])

  const loadQuote = useCallback(() => {
    fetch(`/api/quotes/${id}`)
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
  }, [id])

  const loadVersions = useCallback(() => {
    fetch(`/api/quotes/${id}/versions`)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setVersions(data))
  }, [id])

  const loadApprovals = useCallback(() => {
    fetch(`/api/quotes/${id}/approvals`)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setApprovals(data))
  }, [id])

  const loadComments = useCallback(() => {
    fetch(`/api/quotes/${id}/comments`)
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setComments(data))
  }, [id])

  useEffect(() => {
    loadQuote()
    loadVersions()
    loadApprovals()
    loadComments()
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((items: CatalogOption[]) => setCatalog(items.filter((i) => i.active)))
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setClients(data))
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((session) => setMyRole(session?.user?.role ?? null))
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("send") === "1") {
      setShowSendModal(true)
    }
  }, [loadQuote, loadVersions, loadApprovals, loadComments])

  // Refresh the contacts list whenever the quote's client changes, so the
  // Contact dropdown always reflects contacts belonging to the current client
  useEffect(() => {
    if (!quote?.client?.id) return
    fetch(`/api/clients/${quote.client.id}`)
      .then((res) => res.json())
      .then((data) => setContacts(data.contacts ?? []))
  }, [quote?.client?.id])

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>
  if (notFound) return <p className="text-sm text-red-600">Quote not found.</p>
  if (!quote) return null

  // ─── Send / portal link actions ────────────────────────────────────────
  async function handleMarkSent() {
    setSending(true)
    await fetch(`/api/quotes/${id}/send`, { method: "POST" })
    setSending(false)
    loadQuote()
    loadVersions()
    loadApprovals()
  }

  async function handleApprove(approvalId: string) {
    setDecidingId(approvalId)
    await fetch(`/api/quotes/${id}/approvals/${approvalId}/approve`, { method: "POST" })
    setDecidingId(null)
    loadQuote()
    loadVersions()
    loadApprovals()
  }

  async function handleReject(approvalId: string) {
    const reason = window.prompt("Reason for rejecting (optional):") || ""
    setDecidingId(approvalId)
    await fetch(`/api/quotes/${id}/approvals/${approvalId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    setDecidingId(null)
    loadQuote()
    loadApprovals()
  }

  async function handleReactivate(versionId: string) {
    setReactivatingId(versionId)
    await fetch(`/api/quotes/${versionId}/reactivate`, { method: "POST" })
    setReactivatingId(null)
    loadVersions()
    if (versionId === id) loadQuote()
  }

  function handleCopyLink() {
    if (!quote) return
    const url = `${window.location.origin}/portal/${quote.accessToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreateVersion() {
    setCreatingVersion(true)
    const res = await fetch(`/api/quotes/${id}/versions`, { method: "POST" })
    const newQuote = await res.json()
    setCreatingVersion(false)
    if (res.ok && newQuote.id) {
      window.location.href = `/dashboard/quotes/${newQuote.id}`
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this quote permanently? This can't be undone.")) return
    setDeleting(true)
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" })
    if (res.ok) {
      window.location.href = "/dashboard/quotes"
      return
    }
    const data = await res.json().catch(() => ({}))
    alert(data.error || "Couldn't delete this quote.")
    setDeleting(false)
  }

  async function handleChangeStatus(newStatus: string) {
    setChangingStatus(true)
    await fetch(`/api/quotes/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setChangingStatus(false)
    loadQuote()
    loadVersions()
  }

  async function handlePostComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    await fetch(`/api/quotes/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newComment.trim() }),
    })
    setNewComment("")
    setPostingComment(false)
    loadComments()
  }

  // ─── Header field edits (Draft only) ────────────────────────────────────
  async function updateQuoteField(patch: Record<string, unknown>) {
    await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    loadQuote()
  }

  async function handleClientChange(newClientId: string) {
    // Changing the client invalidates the previously selected contact,
    // since contacts belong to a specific client
    await updateQuoteField({ clientId: newClientId, contactId: null })
  }

  // ─── Line item mutations (passed into the shared LineItemBuilder) ──────
  async function createLineItem(section: string | null, payload: Partial<LineItemBuilderItem>) {
    await fetch(`/api/quotes/${id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, section }),
    })
    loadQuote()
  }

  async function updateLineItem(lineItemId: string, patch: Partial<LineItemBuilderItem>) {
    // Optimistic local update so typing feels instant
    setQuote((prev) =>
      prev
        ? {
            ...prev,
            lineItems: prev.lineItems.map((li) =>
              li.id === lineItemId ? { ...li, ...patch } : li
            ),
          }
        : prev
    )
    await fetch(`/api/quotes/${id}/line-items/${lineItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  }

  async function deleteLineItem(lineItemId: string) {
    // Confirmation happens inside LineItemBuilder before this is called
    await fetch(`/api/quotes/${id}/line-items/${lineItemId}`, { method: "DELETE" })
    loadQuote()
  }

  async function duplicateLineItem(li: LineItemBuilderItem) {
    await fetch(`/api/quotes/${id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: li.section,
        catalogItemId: li.catalogItemId,
        name: li.name,
        description: li.description ?? undefined,
        sku: li.sku ?? undefined,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        cost: li.cost,
        discount: li.discount,
        taxable: li.taxable,
        isRecurring: li.isRecurring,
        recurringInterval: li.recurringInterval ?? undefined,
        isOptional: li.isOptional,
        quantityAdjustable: li.quantityAdjustable,
        choiceGroup: li.choiceGroup ?? undefined,
        isTextBlock: li.isTextBlock,
        bundleName: li.bundleName ?? undefined,
        bundleDisplayMode: li.bundleDisplayMode ?? undefined,
      }),
    })
    loadQuote()
  }

  async function moveItem(section: string | null, itemId: string, direction: "up" | "down") {
    if (!quote) return
    const group = quote.lineItems
      .filter((li) => (li.section ?? null) === section)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = group.findIndex((li) => li.id === itemId)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (idx === -1 || swapIdx < 0 || swapIdx >= group.length) return

    const a = group[idx]
    const b = group[swapIdx]

    // Swap sortOrder values between the two items
    setQuote((prev) =>
      prev
        ? {
            ...prev,
            lineItems: prev.lineItems.map((li) => {
              if (li.id === a.id) return { ...li, sortOrder: b.sortOrder }
              if (li.id === b.id) return { ...li, sortOrder: a.sortOrder }
              return li
            }),
          }
        : prev
    )

    await Promise.all([
      fetch(`/api/quotes/${id}/line-items/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/quotes/${id}/line-items/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ])
  }

  // ─── Totals ──────────────────────────────────────────────────────────────
  // Text blocks are pure content — never counted toward pricing
  const pricedItems = quote.lineItems.filter((li) => !li.isTextBlock)
  const oneTime = pricedItems.filter((li) => !li.isRecurring)
  const oneTimeSubtotal = oneTime.reduce((sum, li) => sum + lineTotal(li), 0)
  const taxableOneTime = oneTime.filter((li) => li.taxable).reduce((s, li) => s + lineTotal(li), 0)
  const tax = taxableOneTime * (quote.taxRate / 100)
  const grandTotalOneTime = oneTimeSubtotal + tax

  const recurringByInterval: Record<RecurringInterval, number> = {
    MONTHLY: 0,
    QUARTERLY: 0,
    ANNUALLY: 0,
  }
  pricedItems
    .filter((li) => li.isRecurring && li.recurringInterval)
    .forEach((li) => {
      recurringByInterval[li.recurringInterval as RecurringInterval] += lineTotal(li)
    })

  const totalCost = pricedItems.reduce((sum, li) => sum + li.cost * li.quantity, 0)
  const totalRevenue = pricedItems.reduce((sum, li) => sum + lineTotal(li), 0)
  const totalMargin = totalRevenue - totalCost
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  const isLocked = quote.status !== "DRAFT"
  const canChangeStatus = !!myRole?.permissions?.quotes?.changeStatus
  const canDeleteQuote = !!myRole?.permissions?.quotes?.delete
  const canEditQuote = !!myRole?.permissions?.quotes?.edit
  const showEditableHeader = !isLocked && canEditQuote

  return (
    <div className="w-full space-y-6">
      <div>
        <Link href="/dashboard/quotes" className="text-sm text-zinc-500 hover:underline inline-block mb-2">
          ← Back to Quotes
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {quote.quoteNumber}
              {quote.version > 1 && (
                <span className="text-base font-normal text-zinc-400"> v{quote.version}</span>
              )}
            </h1>
            {quote.title && <p className="text-zinc-500">{quote.title}</p>}
          </div>
          <div className="flex items-center gap-3">
            {quote.status === "DRAFT" && (
              <>
                <Button size="sm" onClick={() => setShowSendModal(true)}>
                  Send Quote
                </Button>
                <Button size="sm" variant="outline" onClick={handleMarkSent} disabled={sending}>
                  {sending ? "Marking..." : "Mark as Sent (no email)"}
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={handleCopyLink}>
              {copied ? "Copied!" : "Copy Portal Link"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/quotes/${id}/pdf`, "_blank")}
            >
              Download PDF
            </Button>
            {canChangeStatus ? (
              <select
                value={quote.status}
                onChange={(e) => handleChangeStatus(e.target.value)}
                disabled={changingStatus}
                className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 border-0"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="SENT">Sent</option>
                <option value="VIEWED">Viewed</option>
                <option value="ACCEPTED">Approved</option>
                <option value="DECLINED">Lost</option>
                <option value="EXPIRED">Expired</option>
              </select>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800">
                {statusLabel(quote.status)}
              </span>
            )}
          </div>
        </div>
      </div>

      {isLocked && quote.status !== "PENDING_APPROVAL" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950 p-4 flex items-center justify-between">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This quote has been sent and is locked. Create a new version to make changes.
          </p>
          <Button size="sm" onClick={handleCreateVersion} disabled={creatingVersion}>
            {creatingVersion ? "Creating..." : "Create New Version"}
          </Button>
        </div>
      )}

      {quote.status === "PENDING_APPROVAL" && (
        <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950 p-4 space-y-3">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
            This quote needs approval before it can be sent.
          </p>
          <div className="space-y-2">
            {approvals
              .filter((a) => a.status === "PENDING")
              .map((a) => {
                const myRank = myRole?.rank ?? 0
                const requiredRank = a.workflow.requiredRole?.rank ?? 999
                const requiredRoleName = a.workflow.requiredRole?.name ?? "sufficient permission"
                const canDecide = myRank >= requiredRank

                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-md bg-white dark:bg-zinc-900 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{a.workflow.name}</p>
                      <p className="text-xs text-zinc-500">
                        Requires {requiredRoleName} or higher
                      </p>
                    </div>
                    {canDecide ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(a.id)}
                          disabled={decidingId === a.id}
                        >
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => handleApprove(a.id)} disabled={decidingId === a.id}>
                          {decidingId === a.id ? "..." : "Approve"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        Waiting on {requiredRoleName}
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {!quote.isActive && (
        <div className="rounded-md border border-zinc-300 bg-zinc-100 dark:bg-zinc-800 p-4 flex items-center justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This is an archived version. Another version is currently the active one shown to the client.
          </p>
          <Button size="sm" variant="outline" onClick={() => handleReactivate(id)} disabled={reactivatingId === id}>
            {reactivatingId === id ? "Reactivating..." : "Reactivate This Version"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: main content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-md border p-4 space-y-3 text-sm">
            {!showEditableHeader ? (
              <>
                <p><span className="text-zinc-500">Client:</span> {quote.client.name}</p>
                <p>
                  <span className="text-zinc-500">Contact:</span>{" "}
                  {quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : "—"}
                </p>
                <p><span className="text-zinc-500">Rep:</span> {quote.user.name}</p>
                <p>
                  <span className="text-zinc-500">Expires:</span>{" "}
                  {quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString() : "—"}
                </p>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Client</label>
                  <select
                    value={quote.client.id}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Contact</label>
                  <select
                    value={quote.contact?.id ?? ""}
                    onChange={(e) => updateQuoteField({ contactId: e.target.value || null })}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                  >
                    <option value="">No contact selected</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                    ))}
                  </select>
                </div>
                <p><span className="text-zinc-500">Rep:</span> {quote.user.name}</p>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Expiry Date</label>
                  <input
                    key={`expiry-${quote.expiresAt}`}
                    type="date"
                    defaultValue={quote.expiresAt ? quote.expiresAt.slice(0, 10) : ""}
                    onBlur={(e) => updateQuoteField({ expiresAt: e.target.value || null })}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Title / Subject</label>
                  <input
                    key={`title-${quote.title}`}
                    type="text"
                    defaultValue={quote.title ?? ""}
                    onBlur={(e) => updateQuoteField({ title: e.target.value })}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Client-Facing Intro Message</label>
                  <textarea
                    key={`intro-${quote.introText}`}
                    defaultValue={quote.introText ?? ""}
                    onBlur={(e) => updateQuoteField({ introText: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border px-2 py-1.5 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Line Items</h2>

            <LineItemBuilder
              items={quote.lineItems}
              catalog={catalog}
              locked={isLocked}
              onCreate={createLineItem}
              onUpdate={updateLineItem}
              onDelete={deleteLineItem}
              onMove={moveItem}
              onDuplicate={duplicateLineItem}
            />
          </div>

          <div className="rounded-md border p-4 space-y-1 text-sm max-w-md ml-auto">
            <div className="flex justify-between">
              <span className="text-zinc-500">One-Time Subtotal</span>
              <span>{money(oneTimeSubtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Tax ({quote.taxRate}%)</span>
              <span>{money(tax)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Grand Total (One-Time)</span>
              <span>{money(grandTotalOneTime)}</span>
            </div>
            {recurringByInterval.MONTHLY > 0 && (
              <div className="flex justify-between pt-2">
                <span className="text-zinc-500">Monthly Recurring</span>
                <span>{money(recurringByInterval.MONTHLY)}</span>
              </div>
            )}
            {recurringByInterval.QUARTERLY > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Quarterly Recurring</span>
                <span>{money(recurringByInterval.QUARTERLY)}</span>
              </div>
            )}
            {recurringByInterval.ANNUALLY > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Annual Recurring</span>
                <span>{money(recurringByInterval.ANNUALLY)}</span>
              </div>
            )}
            <div className="border-t mt-2 pt-2 space-y-1 text-zinc-500">
              <div className="flex justify-between">
                <span>Internal: Total Cost</span>
                <span>{money(totalCost)}</span>
              </div>
              <div className="flex justify-between">
                <span>Internal: Total Margin $</span>
                <span>{money(totalMargin)}</span>
              </div>
              <div className="flex justify-between">
                <span>Internal: Margin %</span>
                <span>{marginPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Version History + Comments */}
        <div className="lg:col-span-2 space-y-6">
          {versions.length > 1 && (
            <div className="rounded-md border p-4 text-sm">
              <h2 className="font-semibold text-sm mb-2">Version History</h2>
              <div className="space-y-1">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between rounded px-2 py-1 ${
                      v.id === quote.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                  >
                    <a href={`/dashboard/quotes/${v.id}`} className="hover:underline">
                      <span className={v.id === quote.id ? "font-medium" : ""}>
                        v{v.version} {v.id === quote.id && "(viewing)"}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {statusLabel(v.status)} · {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </a>
                    {v.isActive ? (
                      <span className="text-xs font-medium text-green-600">Active</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReactivate(v.id)}
                        disabled={reactivatingId === v.id}
                      >
                        {reactivatingId === v.id ? "..." : "Reactivate"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border p-4 space-y-3">
            <h2 className="font-semibold text-sm">Comments</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-sm text-zinc-500">No messages yet.</p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-md p-3 text-sm max-w-[85%] ${
                    c.authorType === "INTERNAL"
                      ? "bg-zinc-100 dark:bg-zinc-800 ml-auto"
                      : "bg-blue-50 dark:bg-blue-950"
                  }`}
                >
                  <p className="text-xs font-medium text-zinc-500 mb-1">
                    {c.authorName} · {new Date(c.createdAt).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{c.message}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Reply to the client..."
                rows={2}
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <HeroButton
                variant="primary"
                onPress={handlePostComment}
                isDisabled={postingComment || !newComment.trim()}
              >
                {postingComment ? "Sending..." : "Send"}
              </HeroButton>
            </div>
          </div>
        </div>
      </div>

      {canDeleteQuote && (
        <div className="flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Quote"}
          </button>
        </div>
      )}

      {showSendModal && (
        <SendQuoteModal
          quoteId={id}
          defaultTo={quote.contact?.email || quote.client.email || ""}
          quoteNumber={quote.quoteNumber}
          version={quote.version}
          accessToken={quote.accessToken}
          onClose={() => setShowSendModal(false)}
          onSent={() => {
            setShowSendModal(false)
            loadQuote()
            loadVersions()
            loadApprovals()
          }}
        />
      )}
    </div>
  )
}

// ─── Send Quote Modal ───────────────────────────────────────────────────
function SendQuoteModal({
  quoteId,
  defaultTo,
  quoteNumber,
  version,
  accessToken,
  onClose,
  onSent,
}: {
  quoteId: string
  defaultTo: string
  quoteNumber: string
  version: number
  accessToken: string
  onClose: () => void
  onSent: () => void
}) {
  const portalLink =
    typeof window !== "undefined" ? `${window.location.origin}/portal/${accessToken}` : ""
  const displayNumber = version > 1 ? `${quoteNumber} v${version}` : quoteNumber

  const [to, setTo] = useState(defaultTo)
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState(`Quote ${displayNumber}`)
  const [message, setMessage] = useState(
    `Hi,\n\nPlease find your quote ${displayNumber} attached. You can also view it and respond online here:\n${portalLink}\n\nLet us know if you have any questions.`
  )
  const [includePdf, setIncludePdf] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [pendingApprovalMessage, setPendingApprovalMessage] = useState("")

  useEffect(() => {
    fetch("/api/quote-settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.quoteDefaultCc) setCc(json.quoteDefaultCc)
      })
  }, [])

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !message.trim()) {
      setError("To, subject, and message are all required.")
      return
    }
    setSending(true)
    setError("")

    const bodyHtml = message
      .split("\n")
      .map((line) => (line ? line : "<br/>"))
      .join("<br/>")

    const res = await fetch(`/api/quotes/${quoteId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, cc: cc || null, subject, bodyHtml, includePdf }),
    })
    const data = await res.json()
    setSending(false)

    if (!res.ok) {
      setError(data.error || "Something went wrong sending this quote.")
      return
    }

    if (data.pendingApproval) {
      setPendingApprovalMessage(
        "This quote needs approval before it can be sent. Your email has been saved and will send automatically once it's approved."
      )
      setTimeout(onSent, 2000)
      return
    }

    onSent()
  }

  return (
    <Modal maxWidth="lg" scrollable>
      <h2 className="text-lg font-bold">Send Quote</h2>

      {pendingApprovalMessage ? (
        <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-800 dark:text-blue-200">
          {pendingApprovalMessage}
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">CC (optional)</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePdf}
              onChange={(e) => setIncludePdf(e.target.checked)}
            />
            Attach PDF
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}