"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"

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
  client: { id: string; name: string }
  contact: { id: string; firstName: string; lastName: string } | null
  user: { id: string; name: string }
  lineItems: { id: string; name: string; quantity: number; unitPrice: number }[]
}

export default function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [quote, setQuote] = useState<QuoteDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
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

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>
  if (notFound) return <p className="text-sm text-red-600">Quote not found.</p>
  if (!quote) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
          {quote.title && <p className="text-zinc-500">{quote.title}</p>}
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800">
          {quote.status.replace("_", " ")}
        </span>
      </div>

      <div className="rounded-md border p-4 space-y-2 text-sm">
        <h2 className="font-semibold text-sm mb-2">Header</h2>
        <p><span className="text-zinc-500">Client:</span> {quote.client.name}</p>
        <p>
          <span className="text-zinc-500">Contact:</span>{" "}
          {quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : "—"}
        </p>
        <p><span className="text-zinc-500">Rep:</span> {quote.user.name}</p>
        <p><span className="text-zinc-500">Created:</span> {new Date(quote.createdAt).toLocaleDateString()}</p>
        <p>
          <span className="text-zinc-500">Expires:</span>{" "}
          {quote.expiresAt ? new Date(quote.expiresAt).toLocaleDateString() : "—"}
        </p>
        {quote.clientPoNumber && (
          <p><span className="text-zinc-500">Client PO #:</span> {quote.clientPoNumber}</p>
        )}
        {quote.introText && (
          <p><span className="text-zinc-500">Intro:</span> {quote.introText}</p>
        )}
        {quote.internalNotes && (
          <p><span className="text-zinc-500">Internal Notes:</span> {quote.internalNotes}</p>
        )}
      </div>

      <div className="rounded-md border p-4 text-sm">
        <h2 className="font-semibold text-sm mb-2">Line Items ({quote.lineItems.length})</h2>
        {quote.lineItems.length === 0 && (
          <p className="text-zinc-500">No line items yet. The line item builder is coming in the next build step.</p>
        )}
        {quote.lineItems.map((li) => (
          <div key={li.id} className="flex justify-between border-b py-1 last:border-0">
            <span>{li.name}</span>
            <span>{li.quantity} × ${li.unitPrice.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <Link href="/dashboard/quotes" className="text-sm text-zinc-500 hover:underline">
        ← Back to Quotes
      </Link>
    </div>
  )
}