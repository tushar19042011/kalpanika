"use client"

import { useState } from "react"

export function NewsletterUnsubscribeForm({ token }: { token: string }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(false)
    setMessage("")
    try {
      const response = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to unsubscribe.")
      setMessage(data.message ?? "You have been unsubscribed.")
    } catch (submitError) {
      setError(true)
      setMessage(submitError instanceof Error ? submitError.message : "Unable to unsubscribe.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) return <p role="alert" className="mt-8 text-sm text-[#a34d4d]">This unsubscribe link is missing its token. Use the link from your subscription confirmation page.</p>
  return (
    <form onSubmit={submit} className="mt-8">
      <p className="text-sm leading-7 text-[#777064]">Confirm to remove the email address associated with this secure link from the newsletter list.</p>
      <button type="submit" disabled={submitting} className="mt-5 rounded-full bg-[#493323] px-6 py-3 text-sm text-white disabled:opacity-60">
        {submitting ? "Please wait…" : "Unsubscribe"}
      </button>
      {message && <p role={error ? "alert" : "status"} className={`mt-4 text-sm ${error ? "text-[#a34d4d]" : "text-[#3e7654]"}`}>{message}</p>}
    </form>
  )
}
