import { randomBytes } from "node:crypto"
import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { consumePublicSubmissionQuota } from "@/lib/public-form-security"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import { appUrl, hashNewsletterToken, sendNewsletterEmail, validateNewsletterEmailConfiguration, verificationEmail } from "@/lib/newsletter-email"
import type { NewsletterSubscriptionDocument } from "@/lib/store-models"

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 4096) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    const body = input as Record<string, unknown>
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const website = typeof body.website === "string" ? body.website.trim() : ""
    if (website) return NextResponse.json({ error: "Unable to process this request." }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    if (!await consumePublicSubmissionQuota(request, "newsletter", 3)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const database = await getDatabase()
    const collection = database.collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
    const normalizedEmail = email.toLowerCase()
    const existing = await collection.findOne({ normalizedEmail })
    if (existing?.status === "subscribed" && existing.verifiedAt) {
      return NextResponse.json({
        message: "This email is already subscribed to new-product updates.",
        state: "already_subscribed",
      }, { status: 200 })
    }

    validateNewsletterEmailConfiguration()
    const token = randomBytes(32).toString("base64url")
    const now = new Date()
    const subscriberId = existing?._id ?? new ObjectId()
    const update = {
      email,
      normalizedEmail,
      status: "pending" as const,
      verificationTokenHash: hashNewsletterToken(token),
      verificationTokenExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      updatedAt: now,
    }
    const refreshPendingSubscription = async (id: ObjectId) => collection.updateOne(
      { _id: id },
      {
        $set: update,
        $unset: {
          unsubscribedAt: "",
          verifiedAt: "",
          subscribedAt: "",
          unsubscribeTokenHash: "",
          unsubscribeVersion: "",
        },
      },
    )
    if (existing) {
      await refreshPendingSubscription(subscriberId)
    } else {
      try {
        await collection.insertOne({ ...update, _id: subscriberId, createdAt: now })
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
        const duplicate = await collection.findOne({ normalizedEmail })
        if (!duplicate) throw error
        if (duplicate?.status === "subscribed" && duplicate.verifiedAt) {
          return NextResponse.json({
            message: "This email is already subscribed to new-product updates.",
            state: "already_subscribed",
          }, { status: 200 })
        }
        await refreshPendingSubscription(duplicate._id)
      }
    }

    const verification = verificationEmail({
      name: email.split("@")[0],
      url: appUrl(`/newsletter/verify?token=${encodeURIComponent(token)}`),
    })
    await sendNewsletterEmail({
      to: email,
      ...verification,
      idempotencyKey: `newsletter-verification-${hashNewsletterToken(token)}`,
    })
    const message = process.env.NODE_ENV === "production"
      ? "Check your inbox for a confirmation link. Your subscription will start after you confirm your email."
      : `A test confirmation email was sent to ${process.env.NEWSLETTER_TEST_RECIPIENT}.`
    return NextResponse.json({
      message,
      state: "pending_confirmation",
    }, { status: 202, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    console.error("Could not process newsletter subscription.", error)
    return NextResponse.json({
      error: databaseErrorMessage(error, "We could not send a confirmation email. Please try again later."),
    }, { status: 503 })
  }
}
