"use client"

import { useState } from "react"

type Props = {
  id?: string
  className?: string
  inputClassName?: string
  buttonClassName?: string
  labelClassName?: string
}

export function NewsletterForm({
  id = "newsletter-email",
  className = "",
  inputClassName = "",
  buttonClassName = "",
  labelClassName = "",
}: Props) {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage("")
    setError(false)
    try {
      const website = new FormData(event.currentTarget).get("website")
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      })
      const data = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error ?? "Unable to save your subscription.")
      setMessage(data.message ?? "Your subscription has been saved.")
      setEmail("")
    } catch (submitError) {
      setError(true)
      setMessage(submitError instanceof Error ? submitError.message : "Unable to save your subscription.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={className}>
      <form onSubmit={submit} className={labelClassName}>
        <label className="sr-only" htmlFor={id}>Email address</label>
        <input
          id={id}
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          className={inputClassName}
        />
        <input type="text" tabIndex={-1} autoComplete="off" name="website" className="hidden" aria-hidden="true" />
        <button type="submit" disabled={submitting} className={buttonClassName}>
          {submitting ? "Please wait…" : "Subscribe"} <span aria-hidden="true">↗</span>
        </button>
      </form>
      {message && (
        <p role={error ? "alert" : "status"} className={`mt-3 text-xs leading-5 ${error ? "text-[#a34d4d]" : "text-[#493323]"}`}>
          {message}
          {!error && <span> You can unsubscribe from any announcement email.</span>}
        </p>
      )}
    </div>
  )
}
