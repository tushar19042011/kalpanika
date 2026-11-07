import "server-only"
import { MongoClient, type Db } from "mongodb"

declare global {
  var kalpanikaMongoClientPromise: Promise<MongoClient> | undefined
  var kalpanikaMongoIndexesPromise: Promise<void> | undefined
}

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL or MONGODB_URI must be configured.")
    this.name = "DatabaseConfigurationError"
  }
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
  if (!uri) throw new DatabaseConfigurationError()

  if (!globalThis.kalpanikaMongoClientPromise) {
    const client = new MongoClient(uri)
    globalThis.kalpanikaMongoClientPromise = client.connect()
  }

  let client: MongoClient
  try {
    client = await globalThis.kalpanikaMongoClientPromise
  } catch (error) {
    globalThis.kalpanikaMongoClientPromise = undefined
    globalThis.kalpanikaMongoIndexesPromise = undefined
    console.error("MongoDB connection failed.", error)
    throw error
  }

  return client
}

export async function getDatabase(): Promise<Db> {
  const databaseName = process.env.MONGODB_DB?.trim() || "kalpanika"
  const client = await getMongoClient()
  const database = client.db(databaseName)
  if (!globalThis.kalpanikaMongoIndexesPromise) {
    globalThis.kalpanikaMongoIndexesPromise = Promise.all([
      database.collection("categories").createIndex({ slug: 1 }, { unique: true }),
      database.collection("categories").createIndex(
        { seedKey: 1 },
        { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
      ),
      database.collection("products").createIndex({ slug: 1 }, { unique: true }),
      database.collection("products").createIndex({ sku: 1 }, { unique: true }),
      database.collection("products").createIndex(
        { seedKey: 1 },
        { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
      ),
      database.collection("products").createIndex({ categoryId: 1, active: 1 }),
      database.collection("pricingDiscounts").createIndex({ active: 1, startsAt: 1, endsAt: 1 }),
      database.collection("pricingCoupons").createIndex({ code: 1 }, { unique: true }),
      database.collection("pricingCoupons").createIndex({ active: 1, startsAt: 1, endsAt: 1 }),
      database.collection("pricingRedemptions").createIndex(
        { campaignId: 1, campaignType: 1, clerkUserId: 1, orderId: 1 },
        { unique: true },
      ),
      database.collection("pricingRedemptions").createIndex({ campaignId: 1, campaignType: 1, status: 1 }),
      database.collection("products").createIndex({ announcementQueueStatus: 1, announcementEligibleAt: 1 }),
      database.collection("orders").createIndex({ orderId: 1 }, { unique: true }),
      database.collection("orders").createIndex(
        { seedKey: 1 },
        { unique: true, partialFilterExpression: { seedKey: { $type: "string" } } },
      ),
      database.collection("orders").createIndex(
        { idempotencyKey: 1 },
        { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
      ),
      database.collection("orders").createIndex({ clerkUserId: 1, createdAt: -1 }),
      database.collection("orders").createIndex({ createdAt: -1, paymentStatus: 1 }),
      database.collection("users").createIndex({ clerkUserId: 1 }, { unique: true }),
      database.collection("carts").createIndex({ clerkUserId: 1 }, { unique: true }),
      database.collection("wishlists").createIndex({ clerkUserId: 1 }, { unique: true }),
      database.collection("cartMerges").createIndex({ clerkUserId: 1, mergeId: 1 }, { unique: true }),
      database.collection("supportRequests").createIndex({ status: 1, createdAt: -1 }),
      database.collection("supportRequests").createIndex({ email: 1, createdAt: -1 }),
      database.collection("newsletterSubscriptions").createIndex({ normalizedEmail: 1 }, { unique: true }),
      database.collection("newsletterSubscriptions").createIndex(
        { unsubscribeTokenHash: 1 },
        { unique: true, partialFilterExpression: { unsubscribeTokenHash: { $type: "string" } } },
      ),
      database.collection("newsletterSubscriptions").createIndex(
        { verificationTokenHash: 1 },
        { unique: true, partialFilterExpression: { verificationTokenHash: { $type: "string" } } },
      ),
      database.collection("newsletterSubscriptions").createIndex({ status: 1, verifiedAt: 1, _id: 1 }),
      database.collection("newsletterAnnouncements").createIndex({ productId: 1 }, { unique: true }),
      database.collection("newsletterAnnouncements").createIndex({ status: 1, createdAt: 1 }),
      database.collection("newsletterAnnouncementDeliveries").createIndex(
        { announcementId: 1, subscriberId: 1 },
        { unique: true },
      ),
      database.collection("newsletterAnnouncementDeliveries").createIndex({ status: 1, nextAttemptAt: 1 }),
      database.collection("newsletterAnnouncementDeliveries").createIndex({ announcementId: 1, status: 1 }),
      database.collection("publicSubmissionRateLimits").createIndex({ requesterHash: 1, createdAt: -1 }),
      database.collection("publicSubmissionRateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).then(() => undefined)
  }

  try {
    await globalThis.kalpanikaMongoIndexesPromise
  } catch (error) {
    globalThis.kalpanikaMongoIndexesPromise = undefined
    console.error("MongoDB index initialization failed.", error)
    throw error
  }

  return database
}

export function databaseErrorMessage(error: unknown, fallback: string) {
  return error instanceof DatabaseConfigurationError
    ? "Database is not configured. Set DATABASE_URL or MONGODB_URI."
    : fallback
}
