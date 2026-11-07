import type { Metadata } from "next"
import { StorefrontShell } from "@/components/storefront-shell"
import { NewsletterVerifyForm } from "@/components/newsletter-verify-form"

export const metadata: Metadata = {
  title: "Confirm newsletter subscription | Kalpanika",
  description: "Confirm your email address for Kalpanika new-product updates.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function NewsletterVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams
  return (
    <StorefrontShell>
      <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-16 md:px-10 md:py-24">
        <p className="eyebrow">Newsletter preferences</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Confirm your email</h1>
        <NewsletterVerifyForm token={token} />
      </main>
    </StorefrontShell>
  )
}
