import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, Clock3 } from "lucide-react"
import { formatPrice } from "@/lib/products"
import { getDatabase } from "@/lib/mongodb"
import type { OrderDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

export default async function OrderConfirmation({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const { userId } = await auth()
  if (!userId) notFound()

  let order: OrderDocument
  try {
    const result = await (await getDatabase()).collection<OrderDocument>("orders")
      .findOne({ orderId, clerkUserId: userId })
    if (!result) notFound()
    order = result
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error
    console.error("Could not load order confirmation.", error)
    return <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-5 py-20 text-center">
      <h1 className="text-3xl font-medium">Order details are temporarily unavailable.</h1>
      <Link href="/products" className="mt-7 rounded-full bg-[#6f4e37] px-6 py-3 text-sm text-white">Continue shopping</Link>
    </main>
  }

  return <main className="min-h-screen bg-[#fffcf5] px-5 py-12 text-[#191919] md:px-10 md:py-20">
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="font-semibold tracking-[0.22em] text-[#6f4e37]">KALPANIKA</Link>
      <div className="mt-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#f1e6a8] text-[#6f4e37]"><Check /></div>
        <p className="eyebrow mt-7">Order received</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight">Thank you for your order.</h1>
        <p className="mt-4 text-[#777064]">Your order is saved. Payment will remain pending until a payment provider is configured.</p>
      </div>
      <div className="mt-12 rounded-2xl bg-[#f7f1e3] p-6">
        <div className="flex items-center justify-between border-b border-[#d8cdaf] pb-5 text-sm"><span>Order ID</span><strong>{order.orderId}</strong></div>
        <div className="flex items-center gap-3 border-b border-[#d8cdaf] py-5 text-sm">
          <Clock3 className="text-[#6f4e37]" />
          <div><p className="font-medium">Payment {order.paymentStatus}</p><p className="mt-1 text-[#777064]">Payment provider configuration is required to complete payment.</p></div>
        </div>
        <div className="flex flex-col gap-3 py-5 text-sm">
          {order.items.map((item) => <div className="flex justify-between gap-4" key={`${item.sku}-${item.name}`}><span>{item.name} × {item.quantity}</span><span>{formatPrice(item.price * item.quantity)}</span></div>)}
        </div>
        <div className="flex justify-between border-t border-[#d8cdaf] pt-5 text-sm"><span>Order total</span><strong>{formatPrice(order.total)}</strong></div>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/products" className="rounded-full bg-[#6f4e37] px-6 py-3 text-center text-sm text-white">Continue shopping</Link>
        <Link href="/account" className="rounded-full border border-[#e6ddcc] px-6 py-3 text-center text-sm">View your account</Link>
      </div>
    </div>
  </main>
}
