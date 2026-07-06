"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
}

const ROLES = ["ADMIN", "MANAGER", "REP", "ESTIMATOR", "VIEWER"]

export default function UsersRolesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "REP", tempPassword: "" })
  const [message, setMessage] = useState("")

  function loadUsers() {
    fetch("/api/users")
      .then((res) => res.json())
      .then((json) => {
        setUsers(json)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleInvite() {
    setMessage("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })

    if (!res.ok) {
      const err = await res.json()
      setMessage(err.error ?? "Something went wrong")
      return
    }

    setNewUser({ name: "", email: "", role: "REP", tempPassword: "" })
    setShowInvite(false)
    loadUsers()
  }

  async function updateUser(id: string, changes: Partial<Pick<User, "role" | "active">>) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    })
    loadUsers()
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading...</p>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <Button onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? "Cancel" : "Invite User"}
        </Button>
      </div>

      {showInvite && (
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Temporary Password</label>
            <input
              type="text"
              value={newUser.tempPassword}
              onChange={(e) => setNewUser({ ...newUser, tempPassword: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Tell this to the new user directly"
            />
          </div>
          <Button onClick={handleInvite}>Create User</Button>
          {message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Role</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2">{user.name}</td>
              <td className="py-2">{user.email}</td>
              <td className="py-2">
                <select
                  value={user.role}
                  onChange={(e) => updateUser(user.id, { role: e.target.value })}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td className="py-2">{user.active ? "Active" : "Deactivated"}</td>
              <td className="py-2">
                <Button
                  variant="outline"
                  onClick={() => updateUser(user.id, { active: !user.active })}
                >
                  {user.active ? "Deactivate" : "Reactivate"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}