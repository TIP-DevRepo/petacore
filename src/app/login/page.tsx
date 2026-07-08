"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginPage />
    </Suspense>
  )
}

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<"email" | "password">("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const ssoError = searchParams.get("error")
  const ssoErrorMessages: Record<string, string> = {
    no_account_found: "No PetaCore account was found for your Microsoft email. Ask an admin to invite you first.",
    sso_not_available: "Single sign-on isn't set up for your company yet.",
    invalid_state: "That sign-in attempt expired. Please try again.",
    token_exchange_failed: "Microsoft sign-in failed. Please try again.",
    could_not_read_profile: "Couldn't read your Microsoft profile. Please try again.",
    no_email_on_account: "Your Microsoft account doesn't have an email address PetaCore can use.",
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/sso/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()

    if (data.ssoRequired) {
      window.location.href = `/api/sso/start?email=${encodeURIComponent(email)}`
      return
    }

    setStep("password")
    setLoading(false)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">PetaCore</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>

        {ssoError && (
          <p className="text-red-500 text-sm mb-4">
            {ssoErrorMessages[ssoError] || "Something went wrong signing in. Please try again."}
          </p>
        )}

        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-900">{email}</p>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Change
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}