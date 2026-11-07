"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/admin/admin-primitives"
import { money } from "@/lib/admin-data"

type Customer = {
  id: string
  name: string
  username: string | null
  email: string
  createdAt: string
  orderCount: number
  paidTotal: number
  lastOrderAt: string | null
}

export function CustomerManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState("")
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setReady(false)
      try {
        const params = new URLSearchParams({ limit: "50", offset: String(offset) })
        if (query.trim()) params.set("q", query.trim())
        const response = await fetch(`/api/admin/customers?${params}`, { cache: "no-store", signal: controller.signal })
        const data = await response.json() as { customers?: Customer[]; totalCount?: number; error?: string }
        if (!response.ok) throw new Error(data.error ?? "Customer records are temporarily unavailable.")
        if (!controller.signal.aborted) {
          setCustomers(Array.isArray(data.customers) ? data.customers : [])
          setTotalCount(data.totalCount ?? 0)
          setError("")
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Customer records are temporarily unavailable.")
          setCustomers([])
        }
      } finally {
        if (!controller.signal.aborted) setReady(true)
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, offset])

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader title="Customers" description="Customer profiles and order summaries from Clerk and stored orders." />
    <label className="mb-4 flex items-center rounded-lg border border-[#e8e6e0] bg-white px-3">
      <span className="sr-only">Search customers</span>
      <input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0) }} placeholder="Search name, username, or email..." className="w-full bg-transparent py-2.5 text-sm outline-none" />
    </label>
    {error && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] px-4 py-3 text-sm text-[#a34d4d]">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-[#e8e6e0] bg-white">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-[#999]"><tr>{["Customer", "Account created", "Orders", "Paid total", "Last order"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody>
          {ready && customers.map((customer) => <tr key={customer.id} className="border-t border-[#f0eee9]">
            <td className="px-5 py-4"><Link href={`/admin/customers/${encodeURIComponent(customer.id)}`} className="font-medium text-[#6f4e37] hover:underline">{customer.name}</Link><p className="mt-1 text-xs text-[#777]">{customer.email || customer.username || "No public contact details"}</p></td>
            <td className="px-5 py-4 text-[#777]">{new Date(customer.createdAt).toLocaleDateString("en-IN")}</td>
            <td className="px-5 py-4">{customer.orderCount}</td>
            <td className="px-5 py-4">{money(customer.paidTotal)}</td>
            <td className="px-5 py-4 text-[#777]">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-IN") : "—"}</td>
          </tr>)}
          {!ready && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#777]">Loading customers…</td></tr>}
          {ready && !error && customers.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[#777]">{query ? "No customers match this search." : "No customer accounts found."}</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="mt-4 flex items-center justify-between text-sm text-[#777]">
      <span>{totalCount ? `${offset + 1}–${Math.min(offset + customers.length, totalCount)} of ${totalCount}` : "0 customers"}</span>
      <div className="flex gap-2">
        <button type="button" disabled={offset === 0 || !ready} onClick={() => setOffset((current) => Math.max(0, current - 50))} className="rounded-full border border-[#e6ddcc] px-4 py-2 disabled:opacity-40">Previous</button>
        <button type="button" disabled={offset + 50 >= totalCount || !ready} onClick={() => setOffset((current) => current + 50)} className="rounded-full border border-[#e6ddcc] px-4 py-2 disabled:opacity-40">Next</button>
      </div>
    </div>
  </div>
}

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Omit<Customer, "orderCount" | "paidTotal" | "lastOrderAt"> | null>(null)
  const [orders, setOrders] = useState<Array<{
    orderId: string
    status: string
    paymentStatus: string
    total: number
    createdAt: string
    items: { name: string; sku: string; quantity: number; price: number }[]
  }>>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/admin/customers/${encodeURIComponent(customerId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { customer?: typeof customer; orders?: typeof orders; error?: string }
        if (!response.ok || !data.customer) throw new Error(data.error ?? "Customer details are unavailable.")
        setCustomer(data.customer)
        setOrders(Array.isArray(data.orders) ? data.orders : [])
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Customer details are unavailable.")
      })
      .finally(() => { if (!controller.signal.aborted) setReady(true) })
    return () => controller.abort()
  }, [customerId])

  if (!ready) return <p role="status" className="p-8 text-sm text-[#777]">Loading customer details…</p>
  if (error || !customer) return <p role="alert" className="rounded-lg bg-[#fbeaea] p-4 text-sm text-[#a34d4d]">{error || "Customer not found."}</p>

  return <div className="mx-auto max-w-5xl">
    <PageHeader title={customer.name} description="Customer profile and order history." />
    <section className="grid gap-4 rounded-xl border border-[#e8e6e0] bg-white p-5 sm:grid-cols-3">
      <div><p className="text-xs text-[#999]">Email</p><p className="mt-1 break-all text-sm">{customer.email || "Not available"}</p></div>
      <div><p className="text-xs text-[#999]">Username</p><p className="mt-1 text-sm">{customer.username || "Not available"}</p></div>
      <div><p className="text-xs text-[#999]">Account created</p><p className="mt-1 text-sm">{new Date(customer.createdAt).toLocaleDateString("en-IN")}</p></div>
    </section>
    <section className="mt-6">
      <h2 className="mb-4 text-xl font-medium">Order history ({orders.length}{orders.length === 100 ? "+" : ""})</h2>
      {orders.length ? <div className="grid gap-3">{orders.map((order) => <article key={order.orderId} className="rounded-xl border border-[#e8e6e0] bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <Link href={`/admin/orders/${encodeURIComponent(order.orderId)}`} className="font-medium text-[#6f4e37] hover:underline">{order.orderId}</Link>
          <span className="text-sm text-[#777]">{new Date(order.createdAt).toLocaleDateString("en-IN")} · {order.status} · Payment {order.paymentStatus}</span>
          <strong>{money(order.total)}</strong>
        </div>
        <div className="mt-3 border-t border-[#eee] pt-3 text-sm text-[#777]">{order.items.map((item) => <p key={`${item.sku}-${item.name}`}>{item.name} × {item.quantity}</p>)}</div>
      </article>)}</div> : <p className="rounded-xl border border-[#e8e6e0] bg-white p-8 text-center text-sm text-[#777]">No orders are associated with this customer.</p>}
    </section>
  </div>
}
