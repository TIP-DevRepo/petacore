"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

type TriggerType = "TOTAL_THRESHOLD" | "DISCOUNT_THRESHOLD" | "SPECIFIC_USER"
type Role = "ADMIN" | "MANAGER" | "REP" | "ESTIMATOR" | "VIEWER"

interface Workflow {
  id: string
  name: string
  active: boolean
  triggerType: TriggerType
  thresholdValue: number | null
  triggerUserId: string | null
  triggerUser: { name: string } | null
  requiredRole: Role
}

interface UserOption {
  id: string
  name: string
  active: boolean
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  TOTAL_THRESHOLD: "Quote total is at or above a dollar amount",
  DISCOUNT_THRESHOLD: "Any line item's discount is at or above a percentage",
  SPECIFIC_USER: "Quote was created by a specific user",
}

const ROLE_OPTIONS: Role[] = ["ADMIN", "MANAGER", "REP", "ESTIMATOR", "VIEWER"]

export default function ApprovalWorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: "",
    triggerType: "TOTAL_THRESHOLD" as TriggerType,
    thresholdValue: "",
    triggerUserId: "",
    requiredRole: "MANAGER" as Role,
  })

  function loadWorkflows() {
    fetch("/api/approval-workflows")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWorkflows(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadWorkflows()
    fetch("/api/users")
      .then((res) => res.json())
      .then((data: UserOption[]) => setUsers(data.filter((u) => u.active)))
  }, [])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    await fetch("/api/approval-workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        triggerType: form.triggerType,
        thresholdValue: form.triggerType !== "SPECIFIC_USER" ? form.thresholdValue : null,
        triggerUserId: form.triggerType === "SPECIFIC_USER" ? form.triggerUserId : null,
        requiredRole: form.requiredRole,
      }),
    })
    setSaving(false)
    setShowForm(false)
    setForm({ name: "", triggerType: "TOTAL_THRESHOLD", thresholdValue: "", triggerUserId: "", requiredRole: "MANAGER" })
    loadWorkflows()
  }

  async function handleToggleActive(w: Workflow) {
    await fetch(`/api/approval-workflows/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !w.active }),
    })
    loadWorkflows()
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this approval workflow?")) return
    await fetch(`/api/approval-workflows/${id}`, { method: "DELETE" })
    loadWorkflows()
  }

  function describeCondition(w: Workflow) {
    if (w.triggerType === "TOTAL_THRESHOLD") return `Quote total ≥ $${w.thresholdValue?.toFixed(2)}`
    if (w.triggerType === "DISCOUNT_THRESHOLD") return `Any item discount ≥ ${w.thresholdValue}%`
    if (w.triggerType === "SPECIFIC_USER") return `Created by ${w.triggerUser?.name ?? "a specific user"}`
    return ""
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Workflows</h1>
          <p className="text-sm text-zinc-500 mt-1">
            When a quote matches any active rule below, it can&apos;t be sent until someone with the
            required permission approves it.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Workflow"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Workflow Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. High Discount Sign-Off"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Trigger Condition</label>
            <select
              value={form.triggerType}
              onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {(form.triggerType === "TOTAL_THRESHOLD" || form.triggerType === "DISCOUNT_THRESHOLD") && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {form.triggerType === "TOTAL_THRESHOLD" ? "Dollar Amount" : "Discount Percentage"}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.thresholdValue}
                onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })}
                placeholder={form.triggerType === "TOTAL_THRESHOLD" ? "e.g. 10000" : "e.g. 20"}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          )}

          {form.triggerType === "SPECIFIC_USER" && (
            <div>
              <label className="block text-sm font-medium mb-1">User</label>
              <select
                value={form.triggerUserId}
                onChange={(e) => setForm({ ...form, triggerUserId: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Who Must Approve</label>
            <select
              value={form.requiredRole}
              onChange={(e) => setForm({ ...form, requiredRole: e.target.value as Role })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()} (or higher)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? "Creating..." : "Create Workflow"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {workflows.length === 0 && (
          <p className="text-sm text-zinc-500">No approval workflows yet. Quotes will send immediately.</p>
        )}
        {workflows.map((w) => (
          <div key={w.id} className="rounded-md border p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{w.name}</p>
                {!w.active && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {describeCondition(w)} → requires {w.requiredRole.charAt(0) + w.requiredRole.slice(1).toLowerCase()} or higher
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleToggleActive(w)}>
                {w.active ? "Deactivate" : "Activate"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(w.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}