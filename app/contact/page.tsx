import Link from "next/link"
import { StorefrontShell } from "@/components/storefront-shell"
import { ContactForm } from "@/components/contact-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact | Kalpanika",
  description: "Send a support request to Kalpanika.",
}

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim()

  return <StorefrontShell>
    <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 md:px-10 md:py-24">
      <p className="eyebrow">We’re here to help</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Contact us</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-[#777064]">
        Send a message using the form below. Requests are saved for review in the admin dashboard; email notifications and response-time commitments are not configured.
        {contactEmail ? <> You can also email <a className="text-[#6f4e37] underline underline-offset-4" href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : null}
      </p>
      <ContactForm />
      <p className="mt-8 text-sm text-[#777064]">For order details, visit your <Link href="/account" className="text-[#6f4e37] underline underline-offset-4">account</Link>. See <Link href="/faqs" className="text-[#6f4e37] underline underline-offset-4">frequently asked questions</Link>.</p>
    </main>
  </StorefrontShell>
}
