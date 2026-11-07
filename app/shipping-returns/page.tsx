import Link from "next/link"
import { StorefrontShell } from "@/components/storefront-shell"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Shipping & Returns | Kalpanika",
  description: "Current shipping, returns, and order information for Kalpanika.",
}

export default function ShippingReturnsPage() {
  return <StorefrontShell>
    <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 md:px-10 md:py-24">
      <p className="eyebrow">Information</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Shipping &amp; returns</h1>
      <div className="mt-8 grid gap-6 border-t border-[#e6ddcc] pt-7 text-sm leading-7 text-[#777064]">
        <section>
          <h2 className="font-medium text-[#493323]">Shipping</h2>
          <p className="mt-2">Shipping regions, delivery estimates, dispatch timing, tracking, and charges have not been configured. Please do not rely on an order submission as confirmation of shipping.</p>
        </section>
        <section>
          <h2 className="font-medium text-[#493323]">Returns, cancellations &amp; refunds</h2>
          <p className="mt-2">Return eligibility, cancellation rules, return shipping, and refund timing have not been configured. Contact us before placing an order if you need to confirm an order-specific option.</p>
        </section>
        <p>Checkout currently records orders with pending payment. It does not confirm payment or dispatch.</p>
        <p>For order details, visit your <Link href="/account" className="text-[#6f4e37] underline underline-offset-4">account</Link>. For questions, use the <Link href="/contact" className="text-[#6f4e37] underline underline-offset-4">contact form</Link> or see <Link href="/faqs" className="text-[#6f4e37] underline underline-offset-4">FAQs</Link>.</p>
      </div>
    </main>
  </StorefrontShell>
}
