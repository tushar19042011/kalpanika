"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Download, Mail } from "lucide-react"
import { PageHeader, StatusBadge } from "@/components/admin/admin-primitives"
import type { NewsletterAnnouncementStatus, NewsletterDeliveryStatus } from "@/lib/store-models"

type Overview = {
  totalSubscribers: number
  verifiedSubscribers: number
  pendingConfirmation: number
  unsubscribed: number
  announcementCount: number
  sentCount: number
  failedCount: number
}

type Subscriber = {
  id: string
  email: string
  status: "pending" | "subscribed" | "unsubscribed"
  createdAt: string
  updatedAt: string
  verifiedAt: string | null
  subscribedAt: string | null
  unsubscribedAt: string | null
}

type Announcement = {
  id: string
  product: { name: string; slug: string; description: string; price: number; image: string | null }
  status: NewsletterAnnouncementStatus
  totalRecipients: number
  sentCount: number
  failedCount: number
  error: string | null
  createdAt: string
  completedAt: string | null
}

type Delivery = {
  id: string
  email: string
  status: NewsletterDeliveryStatus
  attempts: number
  error: string | null
  providerEmailId: string | null
  sentAt: string | null
  updatedAt: string
}

type Tab = "subscribers" | "announcements"

const statusLabels: Record<NewsletterAnnouncementStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
}

function AdminPageControls({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-[#eee] px-4 py-3 text-xs text-[#777]">
      <span>Page {page} of {pageCount}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded border border-[#e8e6e0] p-1.5 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className="rounded border border-[#e8e6e0] p-1.5 disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  )
}

export function NewsletterManagementPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [tab, setTab] = useState<Tab>("subscribers")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [pageCount, setPageCount] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedSubscriberId, setSelectedSubscriberId] = useState("")
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState("")
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [deliveryPage, setDeliveryPage] = useState(1)
  const [deliveryPageCount, setDeliveryPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const selectedSubscriber = subscribers.find((item) => item.id === selectedSubscriberId)
  const selectedAnnouncement = announcements.find((item) => item.id === selectedAnnouncementId)

  useEffect(() => {
    let cancelled = false
    async function loadOverview() {
      try {
        const response = await fetch("/api/admin/newsletter?view=overview", { cache: "no-store" })
        const data = await response.json() as { overview?: Overview; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Newsletter overview is unavailable.")
        if (!cancelled) setOverview(data.overview ?? null)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Newsletter overview is unavailable.")
      }
    }
    void loadOverview()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      const params = new URLSearchParams({ view: tab, page: String(page) })
      if (tab === "subscribers") {
        if (query.trim()) params.set("q", query.trim())
        if (statusFilter) params.set("status", statusFilter)
      }
      try {
        const response = await fetch(`/api/admin/newsletter?${params}`, { cache: "no-store", signal: controller.signal })
        const data = await response.json() as {
          subscribers?: Subscriber[]
          announcements?: Announcement[]
          pageCount?: number
          totalCount?: number
          error?: string
        }
        if (!response.ok) throw new Error(data.error ?? "Newsletter data is unavailable.")
        if (controller.signal.aborted) return
        setPageCount(data.pageCount ?? 1)
        setTotalCount(data.totalCount ?? 0)
        if (tab === "subscribers") {
          setSubscribers(data.subscribers ?? [])
          setSelectedSubscriberId((current) => (data.subscribers ?? []).some((item) => item.id === current) ? current : "")
        } else {
          setAnnouncements(data.announcements ?? [])
          setSelectedAnnouncementId((current) => (data.announcements ?? []).some((item) => item.id === current) ? current : "")
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Newsletter data is unavailable.")
          setSubscribers([])
          setAnnouncements([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 160)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [tab, page, query, statusFilter])

  useEffect(() => {
    if (!selectedAnnouncementId) {
      setDeliveries([])
      return
    }
    const controller = new AbortController()
    async function loadDeliveries() {
      try {
        const response = await fetch(
          `/api/admin/newsletter/announcements/${encodeURIComponent(selectedAnnouncementId)}?page=${deliveryPage}`,
          { cache: "no-store", signal: controller.signal },
        )
        const data = await response.json() as { deliveries?: Delivery[]; pageCount?: number; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Delivery details are unavailable.")
        if (!controller.signal.aborted) {
          setDeliveries(data.deliveries ?? [])
          setDeliveryPageCount(data.pageCount ?? 1)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Delivery details are unavailable.")
      }
    }
    void loadDeliveries()
    return () => controller.abort()
  }, [selectedAnnouncementId, deliveryPage])

  const cards = overview ? [
    ["Subscribers", overview.totalSubscribers],
    ["Verified", overview.verifiedSubscribers],
    ["Pending confirmation", overview.pendingConfirmation],
    ["Unsubscribed", overview.unsubscribed],
    ["Product announcements", overview.announcementCount],
    ["Emails sent", overview.sentCount],
    ["Failed deliveries", overview.failedCount],
  ] as const : []

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="Newsletter" description="Monitor opted-in subscribers and automated new-product announcements." />
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] p-3 text-sm text-[#a34d4d]">{error}</p>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => <div key={label} className="rounded-xl border border-[#e8e6e0] bg-white p-4"><p className="text-xs text-[#777]">{label}</p><p className="mt-2 text-2xl font-semibold">{value.toLocaleString("en-IN")}</p></div>)}
        {!overview && <p className="p-4 text-sm text-[#777]">Loading newsletter metrics…</p>}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-[#e8e6e0] bg-white p-1">
          <button type="button" onClick={() => { setTab("subscribers"); setPage(1) }} className={`rounded-md px-3 py-2 text-sm ${tab === "subscribers" ? "bg-[#f1ebe4] text-[#6f4e37]" : "text-[#777]"}`}>Subscribers</button>
          <button type="button" onClick={() => { setTab("announcements"); setPage(1) }} className={`rounded-md px-3 py-2 text-sm ${tab === "announcements" ? "bg-[#f1ebe4] text-[#6f4e37]" : "text-[#777]"}`}>Product announcements</button>
        </div>
        {tab === "subscribers" && <a href="/api/admin/newsletter/export" className="inline-flex items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-3 py-2 text-sm text-[#493323] hover:bg-[#fbfaf7]"><Download className="size-4" />Export verified list</a>}
      </div>

      {tab === "subscribers" ? (
        <section className="overflow-hidden rounded-xl border border-[#e8e6e0] bg-white">
          <div className="flex flex-col gap-3 border-b border-[#eee] p-4 sm:flex-row">
            <label className="flex-1"><span className="sr-only">Search subscribers by email</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search subscriber email" className="w-full rounded-lg border border-[#e8e6e0] px-3 py-2.5 text-sm outline-none focus:border-[#6f4e37]" /></label>
            <label><span className="sr-only">Filter subscriber status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="w-full rounded-lg border border-[#e8e6e0] bg-white px-3 py-2.5 text-sm"><option value="">All statuses</option><option value="active">Verified</option><option value="pending">Pending confirmation</option><option value="unsubscribed">Unsubscribed</option></select></label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#faf9f7] text-xs text-[#999]"><tr>{["Email", "Status", "Joined", "Last activity"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-5 py-10 text-center text-[#777]">Loading subscribers…</td></tr>
                  : subscribers.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-[#777]">No subscribers match this search.</td></tr>
                  : subscribers.map((subscriber) => <tr key={subscriber.id} onClick={() => setSelectedSubscriberId(subscriber.id)} className={`cursor-pointer border-t border-[#f0eee9] hover:bg-[#fbfaf7] ${selectedSubscriberId === subscriber.id ? "bg-[#f7f1e3]" : ""}`}>
                    <td className="px-5 py-4 font-medium">{subscriber.email}</td>
                    <td className="px-5 py-4"><StatusBadge tone={subscriber.status === "subscribed" ? "success" : subscriber.status === "pending" ? "warning" : "neutral"}>{subscriber.status === "subscribed" ? "Verified" : subscriber.status === "pending" ? "Pending" : "Unsubscribed"}</StatusBadge></td>
                    <td className="px-5 py-4 text-[#777]">{new Date(subscriber.createdAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-5 py-4 text-[#777]">{new Date(subscriber.updatedAt).toLocaleString("en-IN")}</td>
                  </tr>)}
              </tbody>
            </table>
          </div>
          {selectedSubscriber && <div className="grid gap-2 border-t border-[#eee] bg-[#fbfaf7] px-5 py-4 text-xs text-[#777] sm:grid-cols-3">
            <p><span className="font-medium text-[#493323]">Email:</span> {selectedSubscriber.email}</p>
            <p><span className="font-medium text-[#493323]">Verified:</span> {selectedSubscriber.verifiedAt ? new Date(selectedSubscriber.verifiedAt).toLocaleString("en-IN") : "Not verified"}</p>
            <p><span className="font-medium text-[#493323]">Unsubscribed:</span> {selectedSubscriber.unsubscribedAt ? new Date(selectedSubscriber.unsubscribedAt).toLocaleString("en-IN") : "—"}</p>
          </div>}
          {!loading && totalCount > 0 && <AdminPageControls page={page} pageCount={pageCount} onChange={setPage} />}
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="overflow-hidden rounded-xl border border-[#e8e6e0] bg-white">
            <div className="border-b border-[#eee] px-5 py-4"><p className="text-sm text-[#777]">{totalCount.toLocaleString("en-IN")} announcements</p></div>
            <div className="divide-y divide-[#eee]">
              {loading ? <p className="p-5 text-sm text-[#777]">Loading announcements…</p>
                : announcements.length === 0 ? <p className="p-5 text-sm text-[#777]">No new-product announcements yet.</p>
                : announcements.map((announcement) => <button key={announcement.id} type="button" onClick={() => { setSelectedAnnouncementId(announcement.id); setDeliveryPage(1) }} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-[#fbfaf7] ${selectedAnnouncementId === announcement.id ? "bg-[#f7f1e3]" : ""}`}>
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f1ebe4]">{announcement.product.image ? <img src={announcement.product.image} alt="" className="size-full object-cover" /> : <Mail className="size-5 text-[#a97b4c]" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{announcement.product.name}</span><span className="mt-1 block text-xs text-[#777]">{new Date(announcement.createdAt).toLocaleDateString("en-IN")} · {announcement.sentCount}/{announcement.totalRecipients} sent · {announcement.failedCount} failed</span></span>
                  <StatusBadge tone={announcement.status === "completed" ? "success" : announcement.status === "failed" ? "danger" : "warning"}>{statusLabels[announcement.status]}</StatusBadge>
                </button>)}
            </div>
            {!loading && totalCount > 0 && <AdminPageControls page={page} pageCount={pageCount} onChange={setPage} />}
          </section>
          <section className="min-h-72 overflow-hidden rounded-xl border border-[#e8e6e0] bg-white">
            {!selectedAnnouncement ? <p className="p-5 text-sm text-[#777]">Select a product announcement to inspect its delivery results.</p> : <>
              <div className="border-b border-[#eee] p-5"><h2 className="font-semibold">{selectedAnnouncement.product.name}</h2><p className="mt-1 text-xs text-[#777]">Created {new Date(selectedAnnouncement.createdAt).toLocaleString("en-IN")}</p>{selectedAnnouncement.error && <p className="mt-3 text-xs text-[#a34d4d]">{selectedAnnouncement.error}</p>}</div>
              <div className="max-h-[520px] divide-y divide-[#eee] overflow-y-auto">
                {deliveries.map((delivery) => <div key={delivery.id} className="p-4">
                  <div className="flex items-center justify-between gap-3"><span className="break-all text-xs">{delivery.email}</span><StatusBadge tone={delivery.status === "sent" ? "success" : delivery.status === "failed" ? "danger" : delivery.status === "skipped" ? "neutral" : "warning"}>{delivery.status}</StatusBadge></div>
                  {delivery.status === "failed" && <p className="mt-2 text-xs text-[#a34d4d]">{delivery.error ?? "Delivery failed"} · {delivery.attempts} attempt(s)</p>}
                  {delivery.sentAt && <p className="mt-1 text-xs text-[#777]">Accepted by email provider {new Date(delivery.sentAt).toLocaleString("en-IN")}</p>}
                </div>)}
                {deliveries.length === 0 && <p className="p-5 text-sm text-[#777]">No recipient deliveries have been queued yet. The scheduled worker processes pending announcements.</p>}
              </div>
              {deliveryPageCount > 1 && <AdminPageControls page={deliveryPage} pageCount={deliveryPageCount} onChange={setDeliveryPage} />}
            </>}
          </section>
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-[#777]">Only confirmed, opted-in addresses receive new-product announcements. Product announcements are sent automatically; campaign sending is not available.</p>
    </div>
  )
}
