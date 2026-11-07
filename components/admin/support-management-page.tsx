"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/admin/admin-primitives"
import { StatusBadge } from "@/components/admin/admin-primitives"
import type { SupportRequestStatus } from "@/lib/store-models"

type SupportRequest = {
  id: string
  name: string
  email: string
  orderNumber: string
  message: string
  status: SupportRequestStatus
  createdAt: string
  updatedAt: string
}

const statusLabels: Record<SupportRequestStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
}

export function SupportManagementPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const selected = requests.find((item) => item.id === selectedId)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const searchParams = new URLSearchParams()
        if (query.trim()) searchParams.set("q", query.trim())
        if (statusFilter) searchParams.set("status", statusFilter)
        const response = await fetch(`/api/admin/support?${searchParams.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json() as { requests?: SupportRequest[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Support requests are unavailable.")
        if (!controller.signal.aborted) {
          const nextRequests = Array.isArray(data.requests) ? data.requests : []
          setRequests(nextRequests)
          setSelectedId((current) => nextRequests.some((item) => item.id === current) ? current : nextRequests[0]?.id ?? "")
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setRequests([])
          setSelectedId("")
          setError(loadError instanceof Error ? loadError.message : "Support requests are unavailable.")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, statusFilter])

  async function updateStatus(status: SupportRequestStatus) {
    if (!selected) return
    setSaving(true)
    setFeedback("")
    setError("")
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Could not update this request.")
      setRequests((current) => current.map((item) => item.id === selected.id ? { ...item, status, updatedAt: new Date().toISOString() } : item))
      setFeedback("Request status updated.")
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update this request.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Support requests" description="Review contact form messages and update their status." />
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] p-3 text-sm text-[#a34d4d]">{error}</p>}
      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
        <section className="overflow-hidden rounded-xl border border-[#e8e6e0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#eee] p-4 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search support requests</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or message" className="w-full rounded-lg border border-[#e8e6e0] px-3 py-2 text-sm outline-none focus:border-[#6f4e37]" />
            </label>
            <label>
              <span className="sr-only">Filter by status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-[#e8e6e0] bg-white px-3 py-2 text-sm">
                <option value="">All statuses</option>
                <option value="new">New</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            {loading ? <p className="p-5 text-sm text-[#777]">Loading support requests…</p>
              : requests.length === 0 ? <p className="p-5 text-sm text-[#777]">No support requests found.</p>
              : requests.map((item) => (
                <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setFeedback("") }} className={`block w-full border-b border-[#eee] p-4 text-left hover:bg-[#fbfaf7] ${item.id === selectedId ? "bg-[#f7f1e3]" : ""}`}>
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#222]">{item.name}</span><span className="mt-1 block truncate text-xs text-[#777]">{item.email}</span></span>
                    <StatusBadge tone={item.status === "resolved" ? "success" : item.status === "new" ? "warning" : "neutral"}>{statusLabels[item.status]}</StatusBadge>
                  </span>
                  <span className="mt-2 block line-clamp-2 text-xs leading-5 text-[#777]">{item.message}</span>
                </button>
              ))}
          </div>
          {!loading && requests.length === 100 && <p className="border-t border-[#eee] p-3 text-xs text-[#777]">Showing the latest 100 matches. Refine your search to find older requests.</p>}
        </section>
        <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-6">
          {!selected ? <p className="text-sm text-[#777]">Select a support request to review its details.</p> : <>
            <div className="flex flex-col justify-between gap-4 border-b border-[#eee] pb-5 sm:flex-row sm:items-start">
              <div><h2 className="text-xl font-semibold">{selected.name}</h2><a href={`mailto:${encodeURIComponent(selected.email)}`} className="mt-1 inline-block break-all text-sm text-[#6f4e37] underline underline-offset-4">{selected.email}</a></div>
              <label className="grid gap-1 text-xs text-[#777]">Request status
                <select disabled={saving} value={selected.status} onChange={(event) => void updateStatus(event.target.value as SupportRequestStatus)} className="rounded-lg border border-[#e8e6e0] bg-white px-3 py-2 text-sm text-[#222]">
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-wide text-[#999]">Received</dt><dd className="mt-1">{new Date(selected.createdAt).toLocaleString("en-IN")}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-[#999]">Order number</dt><dd className="mt-1">{selected.orderNumber || "Not provided"}</dd></div>
            </dl>
            <div className="mt-6"><h3 className="text-xs font-medium uppercase tracking-wide text-[#999]">Message</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-[#444]">{selected.message}</p></div>
            {feedback && <p role="status" className="mt-5 text-sm text-[#3e7654]">{feedback}</p>}
          </>}
        </section>
      </div>
    </div>
  )
}
