import type { Metadata } from "next"
import { StorePolicyPage } from "@/components/store-policy-page"
import { privacyNotice } from "@/lib/store-information"

export const metadata: Metadata = {
  title: "Privacy Policy | Kalpanika",
  description: "Draft privacy information for Kalpanika, subject to business and legal review.",
}

export default function PrivacyPolicyPage() {
  return <StorePolicyPage title="Privacy policy" content={privacyNotice} />
}
