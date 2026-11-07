import type { Metadata } from "next"
import { StorePolicyPage } from "@/components/store-policy-page"
import { termsNotice } from "@/lib/store-information"

export const metadata: Metadata = {
  title: "Terms & Conditions | Kalpanika",
  description: "Draft terms for Kalpanika, subject to business and legal review.",
}

export default function TermsAndConditionsPage() {
  return <StorePolicyPage title="Terms & conditions" content={termsNotice} />
}
