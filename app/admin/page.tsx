"use client"

import Link from "next/link"
import { ArrowUpRight, BarChart3, ChevronRight, Package, ShoppingCart, TriangleAlert } from "lucide-react"
import { useMemo } from "react"
import { useAdminData } from "@/components/admin/admin-data-provider"
import { MiniBars, PageHeader, StatCard, StatusBadge } from "@/components/admin/admin-primitives"
import { fulfillmentStatuses, money } from "@/lib/admin-data"

export default function AdminDashboard() {
  const { orders, products, ready, storageError } = useAdminData()
  const lowStockProducts = products.filter((product) => product.status === "Active" && product.stock < 5)
  const paidOrders = orders.filter((order) => order.payment === "Paid" && order.status !== "Cancelled")
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const customerCount = new Set(orders.map((order) => order.email).filter(Boolean)).size
  const statusCounts = fulfillmentStatuses.map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }))
  const statusColors: Record<string, string> = {
    Confirmed: "#d8c47a",
    Processing: "#6f4e37",
    Shipped: "#a97b4c",
    Delivered: "#9cb9a2",
    Cancelled: "#e8e6e0",
  }
  const totalOrders = orders.length
  const conicGradient = statusCounts.reduce((result, item) => {
    const start = statusCounts.slice(0, statusCounts.indexOf(item)).reduce((sum, status) => sum + status.count, 0)
    const end = start + item.count
    const startPercent = totalOrders ? start / totalOrders * 100 : 0
    const endPercent = totalOrders ? end / totalOrders * 100 : 0
    return `${result}${result ? ", " : ""}${statusColors[item.status]} ${startPercent}% ${endPercent}%`
  }, "")
  const revenueValues = useMemo(() => {
    const today = new Date()
    const dailyTotals = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (29 - index))
      return { key: date.toISOString().slice(0, 10), total: 0 }
    })
    const totalsByDate = new Map(dailyTotals.map((day) => [day.key, day]))
    for (const order of paidOrders) {
      if (!order.createdAt) continue
      const day = totalsByDate.get(order.createdAt.slice(0, 10))
      if (day) day.total += order.total
    }
    return dailyTotals.map((day) => day.total)
  }, [paidOrders])
  const dateLabels = useMemo(() => {
    const now = new Date()
    return [0, 7, 14, 21, 29].map((offset) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (29 - offset))
      return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    })
  }, [])

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader title="Store overview" description="Live performance from your catalog and orders." action="Add product" href="/admin/products/new" />
    {storageError && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] px-4 py-3 text-sm text-[#a34d4d]">{storageError}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Paid revenue" value={ready ? money(revenue) : "—"} change={`${paidOrders.length} paid orders`} />
      <StatCard label="Total orders" value={ready ? String(totalOrders) : "—"} />
      <StatCard label="Products" value={ready ? String(products.length) : "—"} change={`${lowStockProducts.length} low stock`} tone="warning" />
      <StatCard label="Customers" value={ready ? String(customerCount) : "—"} />
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">Revenue overview</h2><p className="mt-1 text-sm text-[#777]">Last 30 days · Paid revenue in INR</p></div></div>
        <MiniBars values={revenueValues} />
        <div className="mt-3 flex justify-between text-[11px] text-[#aaa]">{dateLabels.map((label, index) => <span key={`${index}-${label}`}>{label}</span>)}</div>
      </section>
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
        <div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">Order status</h2><p className="mt-1 text-sm text-[#777]">Current order pipeline</p></div><ShoppingCart className="text-[#a97b4c]" /></div>
        <div className="flex items-center gap-6">
          <div className="relative flex size-28 shrink-0 items-center justify-center rounded-full" style={{ background: totalOrders ? `conic-gradient(${conicGradient})` : "#e8e6e0" }}>
            <div className="flex size-20 flex-col items-center justify-center rounded-full bg-white"><span className="text-xl font-semibold">{totalOrders}</span><span className="text-[10px] text-[#999]">orders</span></div>
          </div>
          <div className="flex flex-col gap-3 text-xs">
            {statusCounts.filter((item) => item.count > 0).map((item) => <div key={item.status} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: statusColors[item.status] }} /><span className="text-[#777]">{item.status}</span><strong>{item.count}</strong></div>)}
            {totalOrders === 0 && <p className="text-[#777]">No orders yet.</p>}
          </div>
        </div>
      </section>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="rounded-xl border border-[#e8e6e0] bg-white">
        <div className="flex items-center justify-between border-b border-[#eee] px-5 py-4"><div><h2 className="font-semibold">Recent orders</h2><p className="mt-1 text-sm text-[#777]">Latest customer activity</p></div><Link href="/admin/orders" className="text-xs font-medium text-[#6f4e37]">View all <ArrowUpRight className="inline" /></Link></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#faf9f7] text-xs text-[#999]"><tr><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Total</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>
          {orders.slice(0, 4).map((order) => <tr key={order.id} className="border-t border-[#f0eee9]"><td className="px-5 py-3.5 font-medium"><Link href={`/admin/orders/${order.id}`} className="hover:text-[#6f4e37]">{order.id}</Link></td><td className="px-5 py-3.5 text-[#777]">{order.customer}</td><td className="px-5 py-3.5">{money(order.total)}</td><td className="px-5 py-3.5"><StatusBadge tone={order.status === "Delivered" ? "success" : order.status === "Cancelled" ? "danger" : "warning"}>{order.status}</StatusBadge></td></tr>)}
          {ready && orders.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[#777]">No orders yet.</td></tr>}
          {!ready && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[#777]">Loading orders…</td></tr>}
        </tbody></table></div>
      </section>
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Inventory alerts</h2><p className="mt-1 text-sm text-[#777]">Products that need attention</p></div><TriangleAlert className="text-[#a97b4c]" /></div>
        <div className="mt-5 flex flex-col gap-4">
          {lowStockProducts.length ? lowStockProducts.slice(0, 5).map((product) => <div key={product.id} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`size-10 rounded-lg ${product.stock === 0 ? "bg-[#fbeaea]" : "bg-[#f1ebe4]"}`} /><div><p className="text-sm font-medium">{product.name}</p><p className="text-xs text-[#999]">{product.stock} units left</p></div></div><StatusBadge tone={product.stock === 0 ? "danger" : "warning"}>{product.stock === 0 ? "Out of stock" : "Low stock"}</StatusBadge></div>) : <p className="text-sm text-[#777]">{ready ? "No active products need attention." : "Loading inventory…"}</p>}
        </div>
        <Link href="/admin/products" className="mt-5 block text-xs font-medium text-[#6f4e37]">Review inventory <ChevronRight className="inline" /></Link>
      </section>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <Link href="/admin/products/new" className="rounded-xl border border-[#e8e6e0] bg-white p-4 hover:border-[#c9b9a9]"><Package className="mb-3 text-[#6f4e37]" /><p className="text-sm font-medium">Add a product</p><p className="mt-1 text-xs text-[#777]">List something new in the store</p></Link>
      <Link href="/admin/orders" className="rounded-xl border border-[#e8e6e0] bg-white p-4 hover:border-[#c9b9a9]"><ShoppingCart className="mb-3 text-[#6f4e37]" /><p className="text-sm font-medium">Manage orders</p><p className="mt-1 text-xs text-[#777]">Review and update fulfillment</p></Link>
      <Link href="/admin/analytics" className="rounded-xl border border-[#e8e6e0] bg-white p-4 hover:border-[#c9b9a9]"><BarChart3 className="mb-3 text-[#6f4e37]" /><p className="text-sm font-medium">View Analytics</p><p className="mt-1 text-xs text-[#777]">Check store performance.</p></Link>
    </div>
  </div>
}
