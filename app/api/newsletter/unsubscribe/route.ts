import { NextResponse } from "next/server"
import { hashUnsubscribeToken } from "@/lib/newsletter-email"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import type { NewsletterSubscriptionDocument } from "@/lib/store-models"

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 4096) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid unsubscribe request." }, { status: 400 })
    }
    const token = (input as Record<string, unknown>).token
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return NextResponse.json({ error: "This unsubscribe link is invalid or expired." }, { status: 400 })
    }
    const collection = (await getDatabase()).collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
    const tokenHash = hashUnsubscribeToken(token)
    const subscription = await collection.findOne({ unsubscribeTokenHash: tokenHash })
    if (!subscription) {
      return NextResponse.json({ error: "This unsubscribe link is invalid or expired." }, { status: 404 })
    }
    if (subscription.status !== "unsubscribed") {
      const now = new Date()
      await collection.updateOne(
        { _id: subscription._id, unsubscribeTokenHash: tokenHash, status: "subscribed" },
        {
          $set: { status: "unsubscribed", unsubscribedAt: now, updatedAt: now },
          $unset: { verificationTokenHash: "", verificationTokenExpiresAt: "" },
        },
      )
    }
    return NextResponse.json({ message: "This email address is unsubscribed from the newsletter." })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    console.error("Could not process newsletter unsubscribe request.", error)
    return NextResponse.json({
      error: databaseErrorMessage(error, "The unsubscribe request could not be completed. Please try again later."),
    }, { status: 503 })
  }
}
