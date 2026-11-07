"use client"

import { useState } from "react"

export function NewsletterVerifyForm({ token }: { token: string }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage("")
    setError("")
    try {
      const response = await fetch("/api/newsletter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error ?? "Email confirmation failed.")
      setMessage(data.message ?? "Email confirmed.")
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Email confirmation failed.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) return <p role="alert" className="mt-8 text-sm text-[#a34d4d]">This confirmation link is missing its token.</p>
  return (
    <form onSubmit={submit} className="mt-8">
      <p className="text-sm leading-7 text-[#777064]">Confirm your email address to receive new-product announcements from Kalpanika.</p>
      <button type="submit" disabled={submitting || Boolean(message)} className="mt-5 rounded-full bg-[#493323] px-6 py-3 text-sm text-white disabled:opacity-60">
        {submitting ? "Confirming…" : "Confirm subscription"}
      </button>
      {message && <p role="status" className="mt-4 text-sm text-[#3e7654]">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-[#a34d4d]">{error}</p>}
    </form>
  )
}
