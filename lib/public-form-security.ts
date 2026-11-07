import "server-only"
import { createHmac } from "node:crypto"
import { ObjectId } from "mongodb"
import type { Collection } from "mongodb"
import { getDatabase } from "@/lib/mongodb"
import type { PublicSubmissionRateLimitDocument } from "@/lib/store-models"

export async function consumePublicSubmissionQuota(
  request: Request,
  scope: PublicSubmissionRateLimitDocument["scope"],
  maximum: number,
  windowMs = 60 * 60 * 1000,
) {
  const requesterIp = request.headers.get("x-real-ip")?.trim() || "unknown"
  const secret = process.env.SUPPORT_RATE_LIMIT_SECRET
    || process.env.CLERK_SECRET_KEY
    || process.env.MONGODB_URI
    || process.env.DATABASE_URL
  if (!secret) throw new Error("A server-side secret is required for public form rate limiting.")

  const requesterHash = createHmac("sha256", secret).update(requesterIp).digest("hex")
  const collection = (await getDatabase()).collection<PublicSubmissionRateLimitDocument>("publicSubmissionRateLimits")
  const now = new Date()
  const recentAttempts = await collection.countDocuments({
    scope,
    requesterHash,
    createdAt: { $gte: new Date(now.getTime() - windowMs) },
  })
  if (recentAttempts >= maximum) return false

  await collection.insertOne({
    _id: new ObjectId(),
    scope,
    requesterHash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  })
  return true
}
