import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { NewsletterSubscriptionDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

function csvCell(value: string) {
  const safeValue = /^[\t\r=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replace(/"/g, '""')}"`
}

export async function GET() {
  try {
    await requireAdmin()
    const cursor = (await getDatabase())
      .collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
      .find({ status: "subscribed", verifiedAt: { $type: "date" } })
      .project({ email: 1, subscribedAt: 1, verifiedAt: 1 })
      .sort({ subscribedAt: -1 })
    const rows = ["email,subscribed_at,verified_at"]
    for await (const subscriber of cursor) {
      rows.push([
        csvCell(subscriber.email),
        csvCell(subscriber.subscribedAt?.toISOString() ?? ""),
        csvCell(subscriber.verifiedAt?.toISOString() ?? ""),
      ].join(","))
    }
    const csv = rows.join("\r\n")
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kalpanika-newsletter-subscribers.csv"',
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not export verified newsletter subscribers.", error)
    return NextResponse.json({ error: "Subscriber export is temporarily unavailable." }, { status: 503 })
  }
}
