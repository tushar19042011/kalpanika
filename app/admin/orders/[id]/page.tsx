import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Package, User } from "lucide-react"
import { OrderStatusControl } from "@/components/admin/order-status-control"
import { PageHeader } from "@/components/admin/admin-primitives"
import { money } from "@/lib/admin-data"
import { getDatabase } from "@/lib/mongodb"
import type { OrderDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let order: OrderDocument
  try {
    const result = await (await getDatabase()).collection<OrderDocument>("orders").findOne({ orderId: id })
    if (!result) notFound()
    order = result
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error
    console.error("Could not load admin order details.", error)
    return <main className="mx-auto max-w-3xl rounded-xl border border-[#e8e6e0] bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Order details are temporarily unavailable.</h1>
      <Link href="/admin/orders" className="mt-4 inline-block text-sm text-[#6f4e37] underline">Return to orders</Link>
    </main>
  }

  const customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim()
  return <div className="mx-auto max-w-5xl">
    <Link href="/admin/orders" className="mb-5 inline-flex items-center gap-1 text-sm text-[#777] hover:text-[#6f4e37]"><ChevronLeft />Orders</Link>
    <PageHeader title={`Order ${order.orderId}`} description={`Placed ${order.createdAt.toLocaleDateString("en-IN")}`} />
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="rounded-xl border border-[#e8e6e0] bg-white">
        <div className="border-b border-[#eee] p-5"><h2 className="font-semibold">Order items</h2><p className="mt-1 text-sm text-[#777]">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</p></div>
        {order.items.map((item) => <div key={`${item.sku}-${item.name}`} className="flex items-center justify-between border-b border-[#eee] p-5">
          <div className="flex items-center gap-3"><div className="size-12 overflow-hidden rounded-lg bg-[#f1ebe4]">{item.image && <img src={item.image} alt="" className="size-full object-cover" />}</div><div><p className="font-medium">{item.name}</p><p className="text-xs text-[#999]">Qty {item.quantity} · {item.sku}</p></div></div>
          <p>{money(item.price * item.quantity)}</p>
        </div>)}
        <div className="flex justify-end p-5"><div className="grid w-48 gap-2 text-sm">
          <div className="flex justify-between text-[#777]"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
          <div className="flex justify-between text-[#777]"><span>Shipping</span><span>{order.shippingCharge ? money(order.shippingCharge) : "Free"}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-[#777]"><span>Discount</span><span>-{money(order.discount)}</span></div>}
          <div className="flex justify-between border-t border-[#eee] pt-2 font-semibold"><span>Total</span><span>{money(order.total)}</span></div>
          <div className="flex justify-between text-xs text-[#777]" title="Read-only. Payment status is controlled by verified payment provider events."><span>Payment</span><span className="capitalize">{order.paymentStatus}</span></div>
        </div></div>
      </section>
      <div className="flex flex-col gap-4">
        <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
          <div className="flex items-center gap-2"><User /><h2 className="font-semibold">Customer</h2></div>
          <p className="mt-4 text-sm font-medium">{customerName}</p><p className="mt-1 text-sm text-[#777]">{order.customer.email}</p><p className="mt-1 text-sm text-[#777]">{order.customer.phone}</p>
        </section>
        <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
          <div className="flex items-center gap-2"><Package /><h2 className="font-semibold">Shipping</h2></div>
          <p className="mt-4 text-sm text-[#777]">{order.shipping.address}{order.shipping.landmark ? `, ${order.shipping.landmark}` : ""}<br />{order.shipping.city}, {order.shipping.state} {order.shipping.pin}<br />{order.shipping.country}</p>
        </section>
        <section className="rounded-xl border border-[#e8e6e0] bg-white p-5">
          <div className="flex items-center gap-2"><Package /><h2 className="font-semibold">Fulfillment</h2></div>
          <p className="mt-4 text-sm text-[#777]">Select a valid next status for this order.</p>
          <OrderStatusControl orderId={id} />
        </section>
      </div>
    </div>
  </div>
}
