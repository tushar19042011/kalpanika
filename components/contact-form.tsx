"use client"

import { useState } from "react"

export function ContactForm() {
  const [message, setMessage] = useState("")
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage("")
    setError(false)
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          orderNumber: values.get("orderNumber"),
          message: values.get("message"),
          website: values.get("website"),
        }),
      })
      const data = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(data.error ?? "Your request could not be submitted.")
      setMessage(data.message ?? "Your request has been saved.")
      form.reset()
    } catch (submitError) {
      setError(true)
      setMessage(submitError instanceof Error ? submitError.message : "Your request could not be submitted.")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldClass = "w-full rounded-lg border border-[#e6ddcc] bg-white px-3 py-3 text-sm text-[#493323] outline-none focus:border-[#6f4e37]"
  return (
    <form onSubmit={submit} className="mt-8 grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[#493323]">Name
          <input name="name" autoComplete="name" maxLength={100} required className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm text-[#493323]">Email
          <input name="email" type="email" autoComplete="email" maxLength={254} required className={fieldClass} />
        </label>
      </div>
      <label className="grid gap-2 text-sm text-[#493323]">Order number <span className="font-normal text-[#777064]">(optional)</span>
        <input name="orderNumber" maxLength={80} className={fieldClass} />
      </label>
      <label className="grid gap-2 text-sm text-[#493323]">How can we help?
        <textarea name="message" rows={6} minLength={10} maxLength={4000} required className={`${fieldClass} resize-y`} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button type="submit" disabled={submitting} className="w-fit rounded-full bg-[#493323] px-6 py-3 text-sm text-white disabled:opacity-60">
        {submitting ? "Sending…" : "Send message"}
      </button>
      {message && <p role={error ? "alert" : "status"} className={`text-sm leading-6 ${error ? "text-[#a34d4d]" : "text-[#3e7654]"}`}>{message}</p>}
    </form>
  )
}
