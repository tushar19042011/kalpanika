import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { hashNewsletterToken, createUnsubscribeToken, hashUnsubscribeToken } from "@/lib/newsletter-email"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import type { NewsletterSubscriptionDocument } from "@/lib/store-models"

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 4096) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "This confirmation link is invalid or expired." }, { status: 400 })
    }
    const token = (input as Record<string, unknown>).token
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return NextResponse.json({ error: "This confirmation link is invalid or expired." }, { status: 400 })
    }

    const collection = (await getDatabase()).collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
    const pending = await collection.findOne({
      verificationTokenHash: hashNewsletterToken(token),
      status: "pending",
      verificationTokenExpiresAt: { $gt: new Date() },
    })
    if (!pending) {
      return NextResponse.json({ error: "This confirmation link is invalid, expired, or already used." }, { status: 400 })
    }

    const now = new Date()
    const unsubscribeVersion = randomBytes(32).toString("base64url")
    const result = await collection.updateOne(
      {
        _id: pending._id,
        status: "pending",
        verificationTokenHash: hashNewsletterToken(token),
        verificationTokenExpiresAt: { $gt: now },
      },
      {
        $set: {
          status: "subscribed",
          verifiedAt: now,
          subscribedAt: now,
          unsubscribeVersion,
          unsubscribeTokenHash: hashUnsubscribeToken(createUnsubscribeToken(pending._id.toString(), unsubscribeVersion)),
          updatedAt: now,
        },
        $unset: { verificationTokenHash: "", verificationTokenExpiresAt: "", unsubscribedAt: "" },
      },
    )
    if (!result.matchedCount) {
      return NextResponse.json({ error: "This confirmation link is invalid, expired, or already used." }, { status: 400 })
    }
    return NextResponse.json({ message: "Your email is confirmed. You are subscribed to new-product announcements." })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    console.error("Could not verify newsletter subscription.", error)
    return NextResponse.json({
      error: databaseErrorMessage(error, "Email confirmation is temporarily unavailable."),
    }, { status: 503 })
  }
}
