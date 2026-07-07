"use client"

import { useState, useEffect, useCallback, use } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────
type RecurringInterval = "MONTHLY" | "QUARTERLY" | "ANNUALLY"

interface LineItem {
  id: string
  catalogItemId: string | null
  section: string | null
  sortOrder: number
  name: string
  description: string | null
  sku: string | null
  quantity: number
  unitPrice: number
  cost: number
  discount: number
  taxable: boolean
  isRecurring: boolean
  recurringInterval: RecurringInterval | null
  isOptional: boolean
}

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
  client: { id: string; name: string }
  contact: { id: string; firstName: string; lastName: string } | null
  user: { id: string; name: string }
  lineItems: LineItem[]
}

interface CatalogOption {
  id: string
  name: string
  sku: string | null
  msrp: number
  cost: number
  taxable: boolean
  active: boolean
}

interface DistributorResult {
  id: string
  distributorKey: string
  distributorLabel: string
  name: string
  sku: string
  price: number
  cost: number
  availability: number
}

const NO_SECTION = "__no_section__"

function lineTotal(li: LineItem) {
  return li.unitPrice * li.quantity * (1 - li.discount / 100)
}

function money(n: number) {
  return `$${n.toFixed(2)}`
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
  const [showInternal, setShowInternal] = useState(true)
  const [pendingSections, setPendingSections] = useState<string[]>([])
  const [addModalSection, setAddModalSection] = useState<string | null>(null)
  const [newSectionName, setNewSectionName] = useState("")

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

  useEffect(() => {
    loadQuote()
    fetch("/api/catalog")
      .then((res) => res.json())
      .then((items: CatalogOption[]) => setCatalog(items.filter((i) => i.active)))
  }, [loadQuote])

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>
  if (notFound) return <p className="text-sm text-red-600">Quote not found.</p>
  if (!quote) return null

  // ─── Mutations ────────────────────────────────────────────────────────
  async function createLineItem(section: string | null, payload: Partial<LineItem>) {
    await fetch(`/api/quotes/${id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, section }),
    })
    if (section) setPendingSections((prev) => prev.filter((s) => s !== section))
    loadQuote()
  }

  async function updateLineItem(lineItemId: string, patch: Partial<LineItem>) {
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
    if (!confirm("Remove this line item?")) return
    await fetch(`/api/quotes/${id}/line-items/${lineItemId}`, { method: "DELETE" })
    loadQuote()
  }

  async function duplicateLineItem(li: LineItem) {
    await createLineItem(li.section, {
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
    })
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

  // ─── Derive section groups ──────────────────────────────────────────────
  const realSections: string[] = []
  quote.lineItems
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((li) => {
      const key = li.section ?? NO_SECTION
      if (!realSections.includes(key)) realSections.push(key)
    })
  const sectionKeys = [...realSections, ...pendingSections].filter(
    (v, i, arr) => arr.indexOf(v) === i
  )
  if (sectionKeys.length === 0) sectionKeys.push(NO_SECTION)

  // ─── Totals ──────────────────────────────────────────────────────────────
  const oneTime = quote.lineItems.filter((li) => !li.isRecurring)
  const oneTimeSubtotal = oneTime.reduce((sum, li) => sum + lineTotal(li), 0)
  const taxableOneTime = oneTime.filter((li) => li.taxable).reduce((s, li) => s + lineTotal(li), 0)
  const tax = taxableOneTime * (quote.taxRate / 100)
  const grandTotalOneTime = oneTimeSubtotal + tax

  const recurringByInterval: Record<RecurringInterval, number> = {
    MONTHLY: 0,
    QUARTERLY: 0,
    ANNUALLY: 0,
  }
  quote.lineItems
    .filter((li) => li.isRecurring && li.recurringInterval)
    .forEach((li) => {
      recurringByInterval[li.recurringInterval as RecurringInterval] += lineTotal(li)
    })

  const totalCost = quote.lineItems.reduce((sum, li) => sum + li.cost * li.quantity, 0)
  const totalRevenue = quote.lineItems.reduce((sum, li) => sum + lineTotal(li), 0)
  const totalMargin = totalRevenue - totalCost
  const marginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
          {quote.title && <p className="text-zinc-500">{quote.title}</p>}
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800">
          {quote.status.replace("_", " ")}
        </span>
      </div>

      {/* Header summary */}
      <div className="rounded-md border p-4 space-y-1 text-sm">
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
      </div>

      {/* Line item builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Line Items</h2>
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            <input
              type="checkbox"
              checked={showInternal}
              onChange={(e) => setShowInternal(e.target.checked)}
            />
            Show internal cost/margin columns
          </label>
        </div>

        {sectionKeys.map((sectionKey) => {
          const items = quote.lineItems
            .filter((li) => (li.section ?? NO_SECTION) === sectionKey)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const sectionValue = sectionKey === NO_SECTION ? null : sectionKey

          return (
            <div key={sectionKey} className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
                <h3 className="font-medium text-sm">
                  {sectionKey === NO_SECTION ? "No Section" : sectionKey}
                </h3>
                <Button size="sm" variant="outline" onClick={() => setAddModalSection(sectionKey)}>
                  + Add Line Item
                </Button>
              </div>

              {items.length === 0 && (
                <p className="px-4 py-3 text-sm text-zinc-500">No items in this section yet.</p>
              )}

              {items.length > 0 && (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-left text-xs text-zinc-500">
                      <th className="py-2 pl-4 w-10"></th>
                      <th className="py-2">Part #</th>
                      <th className="py-2">Description</th>
                      <th className="py-2 w-20">Qty</th>
                      <th className="py-2 w-24">Unit Price</th>
                      <th className="py-2 w-20">Disc %</th>
                      <th className="py-2 w-24">Line Total</th>
                      <th className="py-2 w-28">Recurring</th>
                      <th className="py-2 w-16">Opt.</th>
                      {showInternal && <th className="py-2 w-20">Cost</th>}
                      {showInternal && <th className="py-2 w-20">Margin</th>}
                      <th className="py-2 w-24 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((li, idx) => {
                      const total = lineTotal(li)
                      const margin = total - li.cost * li.quantity
                      return (
                        <tr key={li.id} className="border-b last:border-0 align-top">
                          <td className="py-2 pl-4">
                            <div className="flex flex-col">
                              <button
                                disabled={idx === 0}
                                onClick={() => moveItem(sectionValue, li.id, "up")}
                                className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                              >
                                ▲
                              </button>
                              <button
                                disabled={idx === items.length - 1}
                                onClick={() => moveItem(sectionValue, li.id, "down")}
                                className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                              >
                                ▼
                              </button>
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              defaultValue={li.sku ?? ""}
                              onBlur={(e) => updateLineItem(li.id, { sku: e.target.value })}
                              className="w-24 rounded border px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              defaultValue={li.name}
                              onBlur={(e) => updateLineItem(li.id, { name: e.target.value })}
                              className="w-full min-w-[10rem] rounded border px-2 py-1 text-xs font-medium"
                            />
                            <input
                              type="text"
                              defaultValue={li.description ?? ""}
                              placeholder="Description"
                              onBlur={(e) => updateLineItem(li.id, { description: e.target.value })}
                              className="mt-1 w-full min-w-[10rem] rounded border px-2 py-1 text-xs text-zinc-500"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              defaultValue={li.quantity}
                              onBlur={(e) => updateLineItem(li.id, { quantity: Number(e.target.value) })}
                              className="w-16 rounded border px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={li.unitPrice}
                              onBlur={(e) => updateLineItem(li.id, { unitPrice: Number(e.target.value) })}
                              className="w-20 rounded border px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              step="1"
                              defaultValue={li.discount}
                              onBlur={(e) => updateLineItem(li.id, { discount: Number(e.target.value) })}
                              className="w-16 rounded border px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 pr-2 font-medium">{money(total)}</td>
                          <td className="py-2 pr-2">
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={li.isRecurring}
                                  onChange={(e) =>
                                    updateLineItem(li.id, { isRecurring: e.target.checked })
                                  }
                                />
                                Recurring
                              </label>
                              {li.isRecurring && (
                                <select
                                  value={li.recurringInterval ?? "MONTHLY"}
                                  onChange={(e) =>
                                    updateLineItem(li.id, {
                                      recurringInterval: e.target.value as RecurringInterval,
                                    })
                                  }
                                  className="rounded border px-1 py-0.5 text-xs"
                                >
                                  <option value="MONTHLY">Monthly</option>
                                  <option value="QUARTERLY">Quarterly</option>
                                  <option value="ANNUALLY">Annually</option>
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={li.isOptional}
                              onChange={(e) => updateLineItem(li.id, { isOptional: e.target.checked })}
                            />
                          </td>
                          {showInternal && (
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={li.cost}
                                onBlur={(e) => updateLineItem(li.id, { cost: Number(e.target.value) })}
                                className="w-16 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                          )}
                          {showInternal && (
                            <td className="py-2 pr-2 text-xs">
                              {money(margin)}
                              <br />
                              <span className="text-zinc-400">
                                {total > 0 ? `${((margin / total) * 100).toFixed(0)}%` : "—"}
                              </span>
                            </td>
                          )}
                          <td className="py-2 pr-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => duplicateLineItem(li)}
                                title="Duplicate"
                                className="text-xs text-zinc-400 hover:text-zinc-900"
                              >
                                ⧉
                              </button>
                              <button
                                onClick={() => deleteLineItem(li.id)}
                                title="Delete"
                                className="text-xs text-red-400 hover:text-red-700"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}

        {/* Add section */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="New section name (e.g. Hardware)"
            className="w-64 rounded-md border px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={() => {
              const name = newSectionName.trim()
              if (!name) return
              setPendingSections((prev) =>
                prev.includes(name) ? prev : [...prev, name]
              )
              setNewSectionName("")
            }}
          >
            + Add Section
          </Button>
        </div>
      </div>

      {/* Totals */}
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
        {showInternal && (
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
        )}
      </div>

      <Link href="/dashboard/quotes" className="text-sm text-zinc-500 hover:underline">
        ← Back to Quotes
      </Link>

      {addModalSection !== null && (
        <AddLineItemModal
          catalog={catalog}
          onClose={() => setAddModalSection(null)}
          onAddCatalog={(item, quantity) =>
            createLineItem(addModalSection === NO_SECTION ? null : addModalSection, {
              catalogItemId: item.id,
              name: item.name,
              sku: item.sku ?? undefined,
              unitPrice: item.msrp,
              cost: item.cost,
              taxable: item.taxable,
              quantity,
            })
          }
          onAddAdhoc={(payload) =>
            createLineItem(addModalSection === NO_SECTION ? null : addModalSection, payload)
          }
          onAddDistributor={(result, quantity) =>
            createLineItem(addModalSection === NO_SECTION ? null : addModalSection, {
              name: result.name,
              sku: result.sku,
              description: `Via ${result.distributorLabel} (mock data — pending live distributor API)`,
              unitPrice: result.price,
              cost: result.cost,
              quantity,
              taxable: true,
            })
          }
        />
      )}
    </div>
  )
}

// ─── Add Line Item Modal ────────────────────────────────────────────────
function AddLineItemModal({
  catalog,
  onClose,
  onAddCatalog,
  onAddAdhoc,
  onAddDistributor,
}: {
  catalog: CatalogOption[]
  onClose: () => void
  onAddCatalog: (item: CatalogOption, quantity: number) => void
  onAddAdhoc: (payload: Partial<LineItem>) => void
  onAddDistributor: (result: DistributorResult, quantity: number) => void
}) {
  const [mode, setMode] = useState<"catalog" | "distributor" | "adhoc">("catalog")
  const [search, setSearch] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [adhoc, setAdhoc] = useState({
    name: "",
    sku: "",
    quantity: "1",
    unitPrice: "0",
    cost: "0",
  })

  const [distQuery, setDistQuery] = useState("")
  const [distResults, setDistResults] = useState<DistributorResult[]>([])
  const [distMessage, setDistMessage] = useState("")
  const [distLoading, setDistLoading] = useState(false)
  const [distQty, setDistQty] = useState(1)

  async function runDistributorSearch() {
    if (!distQuery.trim()) return
    setDistLoading(true)
    const res = await fetch(`/api/distributor-search?q=${encodeURIComponent(distQuery)}`)
    const data = await res.json()
    setDistResults(data.results ?? [])
    setDistMessage(data.message ?? "")
    setDistLoading(false)
  }

  const filtered = catalog.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.sku ?? "").toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-md p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Line Item</h2>
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setMode("catalog")}
              className={mode === "catalog" ? "font-semibold underline" : "text-zinc-500"}
            >
              From Catalog
            </button>
            <button
              onClick={() => setMode("distributor")}
              className={mode === "distributor" ? "font-semibold underline" : "text-zinc-500"}
            >
              Search Distributors
            </button>
            <button
              onClick={() => setMode("adhoc")}
              className={mode === "adhoc" ? "font-semibold underline" : "text-zinc-500"}
            >
              Ad-Hoc Item
            </button>
          </div>
        </div>

        {mode === "catalog" && (
          <div className="space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or part #..."
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-zinc-500">
                      {item.sku ?? "No SKU"} · ${item.msrp.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onAddCatalog(item, quantity)
                      onClose()
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-zinc-500">No catalog items match.</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-500">Qty</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="w-20 rounded-md border px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}

        {mode === "distributor" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={distQuery}
                onChange={(e) => setDistQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runDistributorSearch()}
                placeholder="Search across your connected distributors..."
                className="flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button onClick={runDistributorSearch} disabled={distLoading}>
                {distLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {distMessage && (
              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 rounded p-2">
                {distMessage}
              </p>
            )}

            <div className="max-h-64 overflow-y-auto space-y-1">
              {distResults.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-zinc-500">
                      {r.distributorLabel} · {r.sku} · ${r.price.toFixed(2)} · {r.availability} in stock
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onAddDistributor(r, distQty)
                      onClose()
                    }}
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>

            {distResults.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-500">Qty</label>
                <input
                  type="number"
                  value={distQty}
                  onChange={(e) => setDistQty(Number(e.target.value) || 1)}
                  className="w-20 rounded-md border px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {mode === "adhoc" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={adhoc.name}
                onChange={(e) => setAdhoc({ ...adhoc, name: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Part # (optional)</label>
                <input
                  type="text"
                  value={adhoc.sku}
                  onChange={(e) => setAdhoc({ ...adhoc, sku: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Qty</label>
                <input
                  type="number"
                  value={adhoc.quantity}
                  onChange={(e) => setAdhoc({ ...adhoc, quantity: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={adhoc.unitPrice}
                  onChange={(e) => setAdhoc({ ...adhoc, unitPrice: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cost (internal)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adhoc.cost}
                  onChange={(e) => setAdhoc({ ...adhoc, cost: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!adhoc.name.trim()) return
                  onAddAdhoc({
                    name: adhoc.name,
                    sku: adhoc.sku || undefined,
                    quantity: Number(adhoc.quantity) || 1,
                    unitPrice: Number(adhoc.unitPrice) || 0,
                    cost: Number(adhoc.cost) || 0,
                  })
                  onClose()
                }}
              >
                Add Item
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}