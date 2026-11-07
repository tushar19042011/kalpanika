import Link from "next/link"
import type { Metadata } from "next"
import { FAQBrowser } from "@/components/faq-browser"
import { StorefrontShell } from "@/components/storefront-shell"

export const metadata: Metadata = {
  title: "FAQs | Kalpanika",
  description: "Answers to common questions about Kalpanika products, orders, and support.",
}

export default function FAQsPage() {
  return (
    <StorefrontShell>
      <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 md:px-10 md:py-24">
        <p className="eyebrow">A few helpful answers</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Frequently asked questions</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#777064]">Search the current store information below. Shipping, returns, and email services that have not been configured are identified clearly.</p>
        <FAQBrowser />
        <p className="mt-8 text-sm text-[#777064]">Still need help? <Link href="/contact" className="text-[#6f4e37] underline underline-offset-4">Contact us</Link>.</p>
      </main>
    </StorefrontShell>
  )
}
