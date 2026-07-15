"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useFixedMenuPosition, useCloseOnOutsideClick, useCloseOnScroll } from "@/lib/useFixedMenu"

// ─── Shared Types ─────────────────────────────────────────────────────────
export type RecurringInterval = "MONTHLY" | "QUARTERLY" | "ANNUALLY"

export interface LineItemBuilderItem {
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
  quantityAdjustable: boolean
  choiceGroup: string | null
  isTextBlock: boolean
  bundleName: string | null
  bundleDisplayMode: string | null
  isBundleHeader: boolean
}

export interface CatalogOption {
  id: string
  name: string
  sku: string | null
  msrp: number
  cost: number
  taxable: boolean
  active: boolean
}

export interface DistributorResult {
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

function lineTotal(li: LineItemBuilderItem) {
  return li.unitPrice * li.quantity * (1 - li.discount / 100)
}

function money(n: number) {
  return `$${n.toFixed(2)}`
}

function getRowAccent(li: LineItemBuilderItem) {
  if (li.isTextBlock) return "border-l-4 border-zinc-300 dark:border-zinc-600"
  if (li.bundleName) return "border-l-4 border-purple-400"
  if (li.choiceGroup) return "border-l-4 border-amber-400"
  if (li.isRecurring) return "border-l-4 border-teal-400"
  if (li.isOptional) return "border-l-4 border-blue-300"
  return "border-l-4 border-transparent"
}

function marginColor(marginPct: number) {
  if (marginPct >= 20) return "text-green-600"
  if (marginPct < 10) return "text-red-500"
  return "text-zinc-500"
}

function marginModifierPct(li: LineItemBuilderItem) {
  if (li.cost <= 0 || li.unitPrice <= 0) return 0
  return ((li.unitPrice - li.cost) / li.unitPrice) * 100
}

// ─── Main Component ─────────────────────────────────────────────────────
interface LineItemBuilderProps {
  items: LineItemBuilderItem[]
  catalog: CatalogOption[]
  locked?: boolean
  onCreate: (section: string | null, payload: Partial<LineItemBuilderItem>) => void | Promise<void>
  onUpdate: (id: string, patch: Partial<LineItemBuilderItem>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onMove: (section: string | null, itemId: string, direction: "up" | "down") => void | Promise<void>
  onDuplicate: (li: LineItemBuilderItem) => void | Promise<void>
}

export function LineItemBuilder({
  items,
  catalog,
  locked = false,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
}: LineItemBuilderProps) {
  const [pendingSections, setPendingSections] = useState<string[]>([])
  const [addModalSection, setAddModalSection] = useState<string | null>(null)
  const [addToBundleName, setAddToBundleName] = useState<string | null>(null)
  const [newSectionName, setNewSectionName] = useState("")
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; bottom: number; right: number } | null>(null)
  const { menuRef: rowMenuRef, style: menuStyle } = useFixedMenuPosition(!!openRowMenu, menuAnchor)

  useCloseOnOutsideClick(!!openRowMenu, [rowMenuRef], () => {
    setOpenRowMenu(null)
    setMenuAnchor(null)
  })

  useCloseOnScroll(!!openRowMenu, () => {
    setOpenRowMenu(null)
    setMenuAnchor(null)
  })

  function handleOpenRowMenu(e: React.MouseEvent<HTMLButtonElement>, itemId: string) {
    if (openRowMenu === itemId) {
      setOpenRowMenu(null)
      setMenuAnchor(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAnchor({ top: rect.top, bottom: rect.bottom, right: rect.right })
    setOpenRowMenu(itemId)
  }

  async function handleAddChoiceGroup(section: string | null) {
    const groupName = window.prompt('Name this choice group (e.g. "Support Tier"):')
    if (!groupName || !groupName.trim()) return
    const name = groupName.trim()
    await onCreate(section, { name: "Option 1", isOptional: true, choiceGroup: name })
    await onCreate(section, { name: "Option 2", isOptional: true, choiceGroup: name })
  }

  async function handleAddBundle(section: string | null) {
    const bundleName = window.prompt('Name this bundle (e.g. "Starter Kit"):')
    if (!bundleName || !bundleName.trim()) return
    const name = bundleName.trim()
    await onCreate(section, { name, bundleName: name, isBundleHeader: true })
  }

  function openAddItemToBundle(section: string | null, bundleName: string) {
    setAddToBundleName(bundleName)
    setAddModalSection(section === null ? NO_SECTION : section)
  }

  async function handleAddTextBlock(section: string | null) {
    await onCreate(section, {
      name: "Section heading",
      description: "Add your text here...",
      unitPrice: 0,
      cost: 0,
      isTextBlock: true,
    })
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this line item?")) return
    await onDelete(id)
  }

  // ─── Derive section groups ────────────────────────────────────────────
  const realSections: string[] = []
  items
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

  const existingChoiceGroups = Array.from(
    new Set(items.map((li) => li.choiceGroup).filter((v): v is string => !!v))
  )
  const existingBundleNames = Array.from(
    new Set(
      items
        .filter((li) => li.isBundleHeader)
        .map((li) => li.bundleName)
        .filter((v): v is string => !!v)
    )
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-teal-400" /> recurring
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-400" /> choice group
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-purple-400" /> bundle
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-blue-300" /> optional
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-zinc-300" /> text block
        </span>
      </div>

      <fieldset disabled={locked} className="space-y-4 border-0 p-0 m-0">
        {sectionKeys.map((sectionKey) => {
          const sectionItems = items
            .filter((li) => (li.section ?? NO_SECTION) === sectionKey)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const sectionValue = sectionKey === NO_SECTION ? null : sectionKey

          return (
            <div key={sectionKey} className="rounded-md border overflow-hidden">
              <div className="flex items-center justify-between bg-zinc-50 px-4 py-2 dark:bg-zinc-900">
                <h3 className="font-medium text-sm">
                  {sectionKey === NO_SECTION ? "No Section" : sectionKey}
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAddModalSection(sectionKey)}>
                    + Add Line Item
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAddChoiceGroup(sectionValue)}>
                    + Choice Group
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAddBundle(sectionValue)}>
                    + Bundle
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAddTextBlock(sectionValue)}>
                    + Text Block
                  </Button>
                </div>
              </div>

              {sectionItems.length === 0 && (
                <p className="px-4 py-3 text-sm text-zinc-500">No items in this section yet.</p>
              )}

              {sectionItems.length > 0 && (() => {
                const bundleChildIds = new Set<string>()
                sectionItems.forEach((li) => {
                  if (li.isBundleHeader) {
                    sectionItems
                      .filter((x) => x.bundleName === li.bundleName && !x.isBundleHeader)
                      .forEach((c) => bundleChildIds.add(c.id))
                  }
                })
                const orderedItems: LineItemBuilderItem[] = []
                const indentedIds = new Set<string>()
                sectionItems.forEach((li) => {
                  if (bundleChildIds.has(li.id)) return
                  orderedItems.push(li)
                  if (li.isBundleHeader) {
                    sectionItems
                      .filter((x) => x.bundleName === li.bundleName && !x.isBundleHeader)
                      .forEach((c) => {
                        orderedItems.push(c)
                        indentedIds.add(c.id)
                      })
                  }
                })

                return (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-left text-xs text-zinc-500">
                        <th className="py-2 pl-4 w-10"></th>
                        <th className="py-2">Part #</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 w-20">Qty</th>
                        <th className="py-2 w-20">Unit Cost</th>
                        <th className="py-2 w-20">Modifier</th>
                        <th className="py-2 w-24">Unit Price</th>
                        <th className="py-2 w-20">Disc %</th>
                        <th className="py-2 w-24">Total</th>
                        <th className="py-2 w-20">Margin</th>
                        <th className="py-2 w-24 pr-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedItems.map((li, idx) => {
                        const total = lineTotal(li)
                        const margin = total - li.cost * li.quantity
                        const marginPct = total > 0 ? (margin / total) * 100 : 0
                        const indent = indentedIds.has(li.id)

                        if (li.isBundleHeader) {
                          return (
                            <tr key={li.id} className={`border-b bg-purple-50 dark:bg-purple-950/30 ${getRowAccent(li)}`}>
                              <td className="py-2 pl-4">
                                <div className="flex flex-col">
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => onMove(sectionValue, li.id, "up")}
                                    className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    disabled={idx === orderedItems.length - 1}
                                    onClick={() => onMove(sectionValue, li.id, "down")}
                                    className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 pr-4" colSpan={9}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-300">
                                    📦 BUNDLE
                                  </span>
                                  <input
                                    type="text"
                                    defaultValue={li.name}
                                    onBlur={(e) => onUpdate(li.id, { name: e.target.value })}
                                    className="flex-1 min-w-[10rem] rounded border px-2 py-1 text-sm font-semibold"
                                  />
                                  <select
                                    value={li.bundleDisplayMode ?? "COLLAPSED"}
                                    onChange={(e) => onUpdate(li.id, { bundleDisplayMode: e.target.value })}
                                    className="rounded border px-1 py-0.5 text-xs"
                                  >
                                    <option value="COLLAPSED">Client sees: combined price</option>
                                    <option value="ITEMIZED">Client sees: itemized</option>
                                  </select>
                                  <button
                                    onClick={() => openAddItemToBundle(sectionValue, li.bundleName ?? "")}
                                    className="text-xs text-purple-600 hover:underline whitespace-nowrap"
                                  >
                                    + Add Item to Bundle
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 pr-4">
                                <button
                                  onClick={() => handleDelete(li.id)}
                                  title="Delete bundle (items inside stay)"
                                  className="text-xs text-red-400 hover:text-red-700"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        }

                        if (li.isTextBlock) {
                          return (
                            <tr key={li.id} className="border-b last:border-0 align-top">
                              <td className={`py-2 pl-4 ${getRowAccent(li)}`}>
                                <div className="flex flex-col">
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => onMove(sectionValue, li.id, "up")}
                                    className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    disabled={idx === orderedItems.length - 1}
                                    onClick={() => onMove(sectionValue, li.id, "down")}
                                    className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 pr-4" colSpan={9}>
                                <input
                                  type="text"
                                  defaultValue={li.name}
                                  onBlur={(e) => onUpdate(li.id, { name: e.target.value })}
                                  className="w-full rounded border px-2 py-1 text-sm font-semibold"
                                />
                                <textarea
                                  defaultValue={li.description ?? ""}
                                  placeholder="Body text (shown to the client)..."
                                  onBlur={(e) => onUpdate(li.id, { description: e.target.value })}
                                  rows={2}
                                  className="mt-1 w-full rounded border px-2 py-1 text-xs text-zinc-500"
                                />
                              </td>
                              <td className="py-2 pr-4">
                                <button
                                  onClick={() => handleDelete(li.id)}
                                  title="Delete"
                                  className="text-xs text-red-400 hover:text-red-700"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={li.id} className="border-b last:border-0 align-top">
                            <td className={`py-2 ${indent ? "pl-10" : "pl-4"} ${getRowAccent(li)}`}>
                              <div className="flex flex-col">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => onMove(sectionValue, li.id, "up")}
                                  className="text-xs text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                                >
                                  ▲
                                </button>
                                <button
                                  disabled={idx === orderedItems.length - 1}
                                  onClick={() => onMove(sectionValue, li.id, "down")}
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
                                onBlur={(e) => onUpdate(li.id, { sku: e.target.value })}
                                className="w-24 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              {li.bundleName && (
                                <p className="text-xs text-purple-500 mb-1">
                                  📦 in {li.bundleName}
                                </p>
                              )}
                              <input
                                type="text"
                                defaultValue={li.name}
                                onBlur={(e) => onUpdate(li.id, { name: e.target.value })}
                                className="w-full min-w-[10rem] rounded border px-2 py-1 text-xs font-medium"
                              />
                              <input
                                type="text"
                                defaultValue={li.description ?? ""}
                                placeholder="Description"
                                onBlur={(e) => onUpdate(li.id, { description: e.target.value })}
                                className="mt-1 w-full min-w-[10rem] rounded border px-2 py-1 text-xs text-zinc-500"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                defaultValue={li.quantity}
                                onBlur={(e) => onUpdate(li.id, { quantity: Number(e.target.value) })}
                                className="w-16 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                key={`cost-${li.id}-${li.cost}`}
                                type="number"
                                step="0.01"
                                defaultValue={li.cost}
                                onBlur={(e) => onUpdate(li.id, { cost: Number(e.target.value) })}
                                className="w-20 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                key={`mod-${li.id}-${li.cost}-${li.unitPrice}`}
                                type="number"
                                step="0.1"
                                defaultValue={marginModifierPct(li).toFixed(1)}
                                onBlur={(e) => {
                                  const mod = Number(e.target.value)
                                  if (!Number.isFinite(mod) || mod >= 100) return
                                  const newPrice = Math.round((li.cost / (1 - mod / 100)) * 100) / 100
                                  onUpdate(li.id, { unitPrice: newPrice })
                                }}
                                className="w-16 rounded border px-2 py-1 text-xs"
                              />
                              <span className="text-zinc-400"> %</span>
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                key={`price-${li.id}-${li.unitPrice}`}
                                type="number"
                                step="0.01"
                                defaultValue={li.unitPrice}
                                onBlur={(e) => onUpdate(li.id, { unitPrice: Number(e.target.value) })}
                                className="w-20 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                step="1"
                                defaultValue={li.discount}
                                onBlur={(e) => onUpdate(li.id, { discount: Number(e.target.value) })}
                                className="w-16 rounded border px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="py-2 pr-2 font-medium">{money(total)}</td>
                            <td className="py-2 pr-2 text-xs">
                              {money(margin)}
                              <br />
                              <span className={marginColor(marginPct)}>
                                {total > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-2 relative">
                                <button
                                  onClick={() => onDuplicate(li)}
                                  title="Duplicate"
                                  className="text-xs text-zinc-400 hover:text-zinc-900"
                                >
                                  ⧉
                                </button>
                                <button
                                  onClick={() => handleDelete(li.id)}
                                  title="Delete"
                                  className="text-xs text-red-400 hover:text-red-700"
                                >
                                  ✕
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenRowMenu(e, li.id)
                                  }}
                                  title="More options"
                                  className="text-xs text-zinc-400 hover:text-zinc-900"
                                >
                                  ⋮
                                </button>
                                {openRowMenu === li.id && (
                                  <div
                                    ref={rowMenuRef}
                                    style={menuStyle}
                                    className="z-50 w-56 rounded-md border bg-white dark:bg-zinc-900 shadow-md p-3 space-y-2 text-xs text-left"
                                  >
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={li.isRecurring}
                                        onChange={(e) => onUpdate(li.id, { isRecurring: e.target.checked })}
                                      />
                                      Recurring
                                    </label>
                                    {li.isRecurring && (
                                      <select
                                        value={li.recurringInterval ?? "MONTHLY"}
                                        onChange={(e) =>
                                          onUpdate(li.id, {
                                            recurringInterval: e.target.value as RecurringInterval,
                                          })
                                        }
                                        className="w-full rounded border px-1 py-0.5 text-xs"
                                      >
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="QUARTERLY">Quarterly</option>
                                        <option value="ANNUALLY">Annually</option>
                                      </select>
                                    )}
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={li.isOptional}
                                        onChange={(e) => onUpdate(li.id, { isOptional: e.target.checked })}
                                      />
                                      Optional
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={li.quantityAdjustable}
                                        onChange={(e) => onUpdate(li.id, { quantityAdjustable: e.target.checked })}
                                      />
                                      Qty adjustable in portal
                                    </label>
                                    <div>
                                      <label className="block text-zinc-500 mb-1">Choice group</label>
                                      <select
                                        value={li.choiceGroup ?? ""}
                                        onChange={(e) => {
                                          if (e.target.value === "__new__") {
                                            const name = window.prompt("New choice group name:")
                                            if (name && name.trim()) {
                                              onUpdate(li.id, { choiceGroup: name.trim() })
                                            }
                                          } else {
                                            onUpdate(li.id, { choiceGroup: e.target.value || null })
                                          }
                                        }}
                                        className="w-full rounded border px-1 py-0.5 text-xs"
                                      >
                                        <option value="">None</option>
                                        {existingChoiceGroups.map((g) => (
                                          <option key={g} value={g}>{g}</option>
                                        ))}
                                        <option value="__new__">+ New group...</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-zinc-500 mb-1">Bundle</label>
                                      <select
                                        value={li.bundleName ?? ""}
                                        onChange={(e) => onUpdate(li.id, { bundleName: e.target.value || null })}
                                        className="w-full rounded border px-1 py-0.5 text-xs"
                                      >
                                        <option value="">None</option>
                                        {existingBundleNames.map((b) => (
                                          <option key={b} value={b}>{b}</option>
                                        ))}
                                      </select>
                                      {existingBundleNames.length === 0 && (
                                        <p className="text-zinc-400 mt-1">
                                          No bundles yet — use + Bundle on the section header to create one.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          )
        })}

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
              setPendingSections((prev) => (prev.includes(name) ? prev : [...prev, name]))
              setNewSectionName("")
            }}
          >
            + Add Section
          </Button>
        </div>
      </fieldset>

      {addModalSection !== null && (
        <AddLineItemModal
          catalog={catalog}
          onClose={() => {
            setAddModalSection(null)
            setAddToBundleName(null)
          }}
          onAddCatalog={(item, quantity) =>
            onCreate(addModalSection === NO_SECTION ? null : addModalSection, {
              catalogItemId: item.id,
              name: item.name,
              sku: item.sku ?? undefined,
              unitPrice: item.msrp,
              cost: item.cost,
              taxable: item.taxable,
              quantity,
              bundleName: addToBundleName ?? undefined,
            })
          }
          onAddAdhoc={(payload) =>
            onCreate(addModalSection === NO_SECTION ? null : addModalSection, {
              ...payload,
              bundleName: addToBundleName ?? payload.bundleName,
            })
          }
          onAddDistributor={(result, quantity) =>
            onCreate(addModalSection === NO_SECTION ? null : addModalSection, {
              name: result.name,
              sku: result.sku,
              description: `Via ${result.distributorLabel} (mock data — pending live distributor API)`,
              unitPrice: result.price,
              cost: result.cost,
              quantity,
              taxable: true,
              bundleName: addToBundleName ?? undefined,
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
  onAddAdhoc: (payload: Partial<LineItemBuilderItem>) => void
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