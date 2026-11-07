"use client"

import { useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download, IndianRupee, Package, ShoppingCart, Sparkles, TrendingUp } from "lucide-react"
import { useAdminData } from "@/components/admin/admin-data-provider"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { money } from "@/lib/admin-data"

type Range = "today" | "7d" | "30d" | "90d" | "year"
const rangeLabels: Record<Range, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", year: "This year" }
const statusColors: Record<string, string> = { Processing: "#a97b4c", Shipped: "#6f4e37", Delivered: "#748b6f", Confirmed: "#d8c47a", Pending: "#b7a58b", Cancelled: "#a86f61" }

export default function AnalyticsPage() {
  const { orders, ready, storageError } = useAdminData()
  const [range, setRange] = useState<Range>("30d")
  const [compare, setCompare] = useState(false)
  const [exported, setExported] = useState(false)
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days + 1)
  const previousStart = new Date(start)
  previousStart.setDate(previousStart.getDate() - days)

  const visibleOrders = orders.filter((order) => {
    if (!order.createdAt) return false
    const createdAt = new Date(order.createdAt)
    return createdAt >= start && createdAt <= end
  })
  const priorOrders = orders.filter((order) => {
    if (!order.createdAt) return false
    const createdAt = new Date(order.createdAt)
    return createdAt >= previousStart && createdAt < start
  })
  const paidOrders = visibleOrders.filter((order) => order.payment === "Paid" && order.status !== "Cancelled")
  const priorPaidOrders = priorOrders.filter((order) => order.payment === "Paid" && order.status !== "Cancelled")
  const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
  const priorRevenue = priorPaidOrders.reduce((sum, order) => sum + order.total, 0)
  const units = paidOrders.reduce((sum, order) => sum + (order.itemSnapshots?.reduce((count, item) => count + item.quantity, 0) ?? order.items), 0)
  const average = paidOrders.length ? Math.round(revenue / paidOrders.length) : 0
  const revenueChange = priorRevenue ? Math.round((revenue / priorRevenue - 1) * 100) : revenue ? 100 : 0

  const revenueSeries = useMemo(() => {
    const result = Array.from({ length: days }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return {
        key: date.toISOString().slice(0, 10),
        date: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: 0,
        orders: 0,
      }
    })
    const byDate = new Map(result.map((entry) => [entry.key, entry]))
    for (const order of visibleOrders) {
      if (!order.createdAt) continue
      const point = byDate.get(order.createdAt.slice(0, 10))
      if (!point) continue
      point.orders += 1
      if (order.payment === "Paid" && order.status !== "Cancelled") point.revenue += order.total
    }
    return result.length ? result : [{ key: "none", date: "No data", revenue: 0, orders: 0 }]
  }, [days, start.getTime(), visibleOrders])

  const statusData = ["Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]
    .map((status) => ({ status, orders: visibleOrders.filter((order) => order.status === status).length }))
    .filter((item) => item.orders > 0)

  const { categoryData, productData } = useMemo(() => {
    const categories = new Map<string, number>()
    const products = new Map<string, { units: number; revenue: number }>()
    for (const order of paidOrders) {
      for (const item of order.itemSnapshots ?? []) {
        const category = item.category || "Uncategorized"
        categories.set(category, (categories.get(category) ?? 0) + item.price * item.quantity)
        const product = products.get(item.name) ?? { units: 0, revenue: 0 }
        product.units += item.quantity
        product.revenue += item.price * item.quantity
        products.set(item.name, product)
      }
    }
    return {
      categoryData: [...categories].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value),
      productData: [...products].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.units - a.units),
    }
  }, [paidOrders])

  const kpis = [
    { label: "Paid revenue", value: money(revenue), helper: paidOrders.length ? `${paidOrders.length} paid orders` : "No paid orders in period", icon: IndianRupee, change: revenueChange },
    { label: "Total orders", value: visibleOrders.length.toString(), helper: "Orders placed", icon: ShoppingCart, change: priorOrders.length ? Math.round((visibleOrders.length / priorOrders.length - 1) * 100) : 0 },
    { label: "Average order value", value: money(average), helper: "Per paid order", icon: TrendingUp, change: 0 },
    { label: "Products sold", value: units.toString(), helper: "Units in paid orders", icon: Package, change: 0 },
  ]

  const exportReport = () => {
    const csv = ["Metric,Value", ...kpis.map((item) => `"${item.label}","${item.value}"`)].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "kalpanika-analytics.csv"
    anchor.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 1800)
  }

  if (!ready) return <p role="status" className="p-8 text-sm text-[#777]">Loading analytics…</p>
  if (storageError) return <p role="alert" className="rounded-lg bg-[#fbeaea] p-4 text-sm text-[#a34d4d]">{storageError}</p>

  return <div className="mx-auto max-w-[1440px] pb-10">
    <header className="mb-7 flex flex-col gap-5 border-b border-[#e8e6e0] pb-6 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a97b4c]">Insights / Performance</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Analytics</h1><p className="mt-2 max-w-xl text-sm text-[#777]">Performance calculated from stored orders and product snapshots.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-3"><CalendarDays className="size-4 text-[#777]" /><select value={range} onChange={(event) => setRange(event.target.value as Range)} className="bg-transparent py-2.5 text-sm outline-none">{Object.entries(rangeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-3 py-2.5 text-xs text-[#777]"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} className="accent-[#6f4e37]" /> Compare period</label>
        <button onClick={exportReport} className="inline-flex items-center gap-2 rounded-lg bg-[#493323] px-3.5 py-2.5 text-xs font-medium text-white hover:bg-[#6f4e37]"><Download className="size-4" />{exported ? "Exported" : "Export report"}</button>
      </div>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map(({ label, value, helper, icon: Icon, change }) => <div key={label} className="rounded-xl border border-[#e8e6e0] bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm text-[#777]">{label}</p><Icon className="size-4 text-[#a97b4c]" /></div><p className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{value}</p><div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#999]"><span>{helper}</span>{compare && <span className={change >= 0 ? "inline-flex items-center text-[#58755f]" : "inline-flex items-center text-[#a86f61]"}>{change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(change)}%</span>}</div></div>)}
    </section>
    <section className="mt-5 rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold">Revenue overview</h2><p className="mt-1 text-xs text-[#999]">Paid revenue across {rangeLabels[range].toLowerCase()}.</p></div><p className="text-lg font-semibold text-[#6f4e37]">{money(revenue)}</p></div>
      <div className="mt-6 h-[280px]">
        <ChartContainer config={{ revenue: { label: "Revenue", color: "#6f4e37" }, orders: { label: "Orders", color: "#d8c47a" } }}>
          <AreaChart data={revenueSeries} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6f4e37" stopOpacity={0.22} /><stop offset="100%" stopColor="#6f4e37" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#eee9df" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#999", fontSize: 11 }} interval="preserveStartEnd" /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#999", fontSize: 11 }} tickFormatter={(value) => `₹${Number(value) / 1000}k`} /><ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-revenue)" fill="url(#revenueFill)" strokeWidth={2.5} />
            {compare && <Area type="monotone" dataKey="orders" name="Orders" stroke="var(--color-orders)" fill="none" strokeDasharray="5 5" />}
          </AreaChart>
        </ChartContainer>
      </div>
    </section>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Sales by category</h2><p className="mt-1 text-xs text-[#999]">Revenue attribution from paid order snapshots.</p>
        {categoryData.length ? <div className="mt-5 flex flex-col gap-4">{categoryData.map((item) => <div key={item.category}><div className="mb-1 flex justify-between text-sm"><span>{item.category}</span><span className="text-[#777]">{money(item.value)}</span></div><div className="h-2 rounded-full bg-[#f1f0ed]"><div className="h-2 rounded-full bg-[#6f4e37]" style={{ width: `${revenue ? Math.max(2, item.value / revenue * 100) : 0}%` }} /></div></div>)}</div> : <div className="flex min-h-44 items-center justify-center text-center text-sm text-[#999]"><div><Sparkles className="mx-auto mb-2 size-5 text-[#d8c47a]" /><p>No paid product lines in this period.</p></div></div>}
      </section>
      <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Order status breakdown</h2><p className="mt-1 text-xs text-[#999]">All orders in the selected period.</p>
        {statusData.length ? <div className="mt-5 grid items-center gap-5 sm:grid-cols-[160px_1fr]">
          <div className="h-40"><ChartContainer config={Object.fromEntries(statusData.map((item) => [item.status, { label: item.status, color: statusColors[item.status] }]))}><PieChart><Pie data={statusData} dataKey="orders" nameKey="status" innerRadius={48} outerRadius={70} paddingAngle={3}>{statusData.map((item) => <Cell key={item.status} fill={statusColors[item.status]} />)}</Pie><ChartTooltip content={<ChartTooltipContent />} /></PieChart></ChartContainer></div>
          <div className="flex flex-col gap-2">{statusData.map((item) => <div key={item.status} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-[#777]"><span className="size-2 rounded-full" style={{ backgroundColor: statusColors[item.status] }} />{item.status}</span><strong>{item.orders}</strong></div>)}</div>
        </div> : <div className="flex min-h-44 items-center justify-center text-sm text-[#999]">No orders in this period.</div>}
      </section>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <ProductInsight title="Best-selling products" products={productData.slice(0, 5)} />
      <ProductInsight title="Lowest-selling products" products={[...productData].sort((a, b) => a.units - b.units).slice(0, 5)} />
    </div>
    {visibleOrders.length === 0 && <p className="mt-5 text-center text-sm text-[#777]">No orders were recorded in {rangeLabels[range].toLowerCase()}.</p>}
  </div>
}

function ProductInsight({ title, products }: { title: string; products: { name: string; units: number; revenue: number }[] }) {
  return <section className="rounded-xl border border-[#e8e6e0] bg-white p-5 sm:p-6">
    <h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-[#999]">Paid product sales in the selected period.</p>
    {products.length ? <div className="mt-5 grid gap-3">{products.map((product) => <div key={product.name} className="flex justify-between gap-4 border-b border-[#f0eee9] pb-3 text-sm"><span>{product.name} <span className="text-xs text-[#999]">· {product.units} units</span></span><strong>{money(product.revenue)}</strong></div>)}</div> : <div className="flex min-h-36 items-center justify-center text-sm text-[#999]">No paid product sales in this period.</div>}
  </section>
}
