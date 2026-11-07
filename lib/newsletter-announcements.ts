import "server-only"
import type { Collection, Filter } from "mongodb"
import { appUrl, createUnsubscribeToken, NewsletterEmailError, productAnnouncementEmail, sendNewsletterEmail, validateNewsletterEmailConfiguration } from "@/lib/newsletter-email"
import { getDatabase } from "@/lib/mongodb"
import type {
  CategoryDocument,
  NewsletterAnnouncementDocument,
  NewsletterDeliveryDocument,
  NewsletterSubscriptionDocument,
  ProductDocument,
} from "@/lib/store-models"

const RECIPIENT_BATCH_SIZE = 100
const DELIVERY_BATCH_SIZE = 5
const MAX_DELIVERY_ATTEMPTS = 5
const ANNOUNCEMENT_LEASE_MS = 60_000
const DELIVERY_LEASE_MS = 30_000

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function eligibleProduct(product: ProductDocument, category: CategoryDocument | null) {
  return product.active
    && !product.archived
    && category?.active === true
    && Boolean(product.name.trim() && product.slug.trim() && product.description.trim())
    && Number.isFinite(product.price)
    && product.price > 0
}

function announcementSnapshot(product: ProductDocument) {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description.slice(0, 1000),
    price: product.price,
    image: product.images[0] ?? null,
  }
}

export async function enqueueProductAnnouncement(
  database: Awaited<ReturnType<typeof getDatabase>>,
  product: ProductDocument,
  category: CategoryDocument,
) {
  if (!eligibleProduct(product, category)) return
  const announcements = database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements")
  const now = product.announcementEligibleAt ?? product.createdAt
  await announcements.updateOne(
    { productId: product._id },
    {
      $setOnInsert: {
        productId: product._id,
        product: announcementSnapshot(product),
        status: "pending",
        recipientSnapshotComplete: false,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  )
  await database.collection<ProductDocument>("products").updateOne(
    { _id: product._id, announcementQueueStatus: "pending" },
    { $set: { announcementQueuedAt: now, announcementQueueStatus: "queued" } },
  )
}

async function recoverMissedAnnouncements() {
  const database = await getDatabase()
  const products = database.collection<ProductDocument>("products")
  const candidates = await products.find({
    active: true,
    archived: { $ne: true },
    announcementQueueStatus: "pending",
    announcementEligibleAt: { $type: "date" },
  }).sort({ announcementEligibleAt: 1 }).limit(25).toArray()
  const categories = database.collection<CategoryDocument>("categories")
  for (const product of candidates) {
    const alreadyQueued = await database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements")
      .findOne({ productId: product._id }, { projection: { _id: 1 } })
    if (alreadyQueued) {
      await products.updateOne(
        { _id: product._id, announcementQueueStatus: "pending" },
        { $set: { announcementQueuedAt: product.announcementEligibleAt, announcementQueueStatus: "queued" } },
      )
      continue
    }
    const deactivatedAfterPublish = product.adminHistory?.some((entry) =>
      entry.field === "visibility" && entry.to === false && entry.updatedAt >= (product.announcementEligibleAt ?? product.createdAt),
    )
    if (deactivatedAfterPublish) {
      await products.updateOne(
        { _id: product._id, announcementQueueStatus: "pending" },
        { $set: { announcementQueuedAt: product.announcementEligibleAt, announcementQueueStatus: "suppressed" } },
      )
      continue
    }
    const category = await categories.findOne({ _id: product.categoryId })
    if (category?.active) {
      await enqueueProductAnnouncement(database, product, category)
    } else {
      await products.updateOne(
        { _id: product._id, announcementQueueStatus: "pending" },
        { $set: { announcementQueueStatus: "suppressed" } },
      )
    }
  }
}

function retryDelay(attempt: number) {
  return [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000][Math.min(attempt - 1, 3)]
}

async function claimAnnouncement(
  collection: Collection<NewsletterAnnouncementDocument>,
  now: Date,
) {
  const candidate = await collection.findOne({
    $or: [
      { status: "pending" },
      { status: "processing", leaseUntil: { $lte: now } },
    ],
  }, { sort: { createdAt: 1 } }) as NewsletterAnnouncementDocument | null
  if (!candidate) return null
  const claimFilter: Filter<NewsletterAnnouncementDocument> = candidate.status === "pending"
    ? { _id: candidate._id, status: "pending" }
    : { _id: candidate._id, status: "processing", leaseUntil: { $lte: now } }
  const claimed = await collection.updateOne(
    claimFilter,
    { $set: { status: "processing", leaseUntil: new Date(now.getTime() + ANNOUNCEMENT_LEASE_MS), updatedAt: now } },
  )
  return claimed.matchedCount ? candidate : null
}

async function createRecipientSnapshot(
  database: Awaited<ReturnType<typeof getDatabase>>,
  announcement: NewsletterAnnouncementDocument,
) {
  const subscribers = database.collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
  const deliveries = database.collection<NewsletterDeliveryDocument>("newsletterAnnouncementDeliveries")
  const query: Record<string, unknown> = {
    status: "subscribed",
    verifiedAt: { $type: "date" },
    subscribedAt: { $lte: announcement.createdAt },
  }
  if (announcement.recipientCursor) query._id = { $gt: announcement.recipientCursor }
  const batch = await subscribers.find(query).sort({ _id: 1 }).limit(RECIPIENT_BATCH_SIZE).toArray()
  if (batch.length) {
    const now = new Date()
    const result = await deliveries.bulkWrite(batch.map((subscriber) => ({
      updateOne: {
        filter: { announcementId: announcement._id, subscriberId: subscriber._id },
        update: {
          $setOnInsert: {
            announcementId: announcement._id,
            subscriberId: subscriber._id,
            email: subscriber.email,
            status: "pending",
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })), { ordered: false })
    await database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements").updateOne(
      { _id: announcement._id, status: "processing" },
      {
        $set: {
          recipientCursor: batch[batch.length - 1]._id,
          recipientSnapshotComplete: batch.length < RECIPIENT_BATCH_SIZE,
          status: "pending",
          updatedAt: now,
        },
        $inc: { totalRecipients: result.upsertedCount },
        $unset: { leaseUntil: "" },
      },
    )
  } else {
    await database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements").updateOne(
      { _id: announcement._id, status: "processing" },
      {
        $set: { recipientSnapshotComplete: true, status: "pending", updatedAt: new Date() },
        $unset: { leaseUntil: "" },
      },
    )
  }
}

async function processDeliveryBatch(
  database: Awaited<ReturnType<typeof getDatabase>>,
  announcement: NewsletterAnnouncementDocument,
) {
  const deliveries = database.collection<NewsletterDeliveryDocument>("newsletterAnnouncementDeliveries")
  const subscribers = database.collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
  const now = new Date()
  const candidates = await deliveries.find({
    announcementId: announcement._id,
    $or: [
      { status: "pending", nextAttemptAt: { $lte: now } },
      { status: "processing", leaseUntil: { $lte: now } },
    ],
  }).sort({ createdAt: 1 }).limit(DELIVERY_BATCH_SIZE).toArray()

  for (const delivery of candidates) {
    const claimFilter: Filter<NewsletterDeliveryDocument> = delivery.status === "pending"
      ? { _id: delivery._id, status: "pending", nextAttemptAt: { $lte: new Date() } }
      : { _id: delivery._id, status: "processing", leaseUntil: { $lte: new Date() } }
    const claimAt = new Date()
    const claimed = await deliveries.updateOne(
      claimFilter,
      {
        $set: { status: "processing", leaseUntil: new Date(claimAt.getTime() + DELIVERY_LEASE_MS), updatedAt: claimAt },
        $inc: { attempts: 1 },
      },
    )
    if (!claimed.matchedCount) continue

    const subscriber = await subscribers.findOne({
      _id: delivery.subscriberId,
      status: "subscribed",
      verifiedAt: { $type: "date" },
    })
    if (!subscriber) {
      await deliveries.updateOne(
        { _id: delivery._id, status: "processing" },
        {
          $set: { status: "skipped", lastError: "Subscriber unsubscribed before delivery.", updatedAt: new Date() },
          $unset: { leaseUntil: "" },
        },
      )
      continue
    }
    if (!subscriber.unsubscribeVersion) {
      await deliveries.updateOne(
        { _id: delivery._id, status: "processing" },
        {
          $set: { status: "skipped", lastError: "Subscriber has no verified unsubscribe token.", updatedAt: new Date() },
          $unset: { leaseUntil: "" },
        },
      )
      continue
    }

    const productUrl = appUrl(`/products/${encodeURIComponent(announcement.product.slug)}`)
    const unsubscribeToken = createUnsubscribeToken(subscriber._id.toString(), subscriber.unsubscribeVersion)
    const email = productAnnouncementEmail({
      name: announcement.product.name,
      description: announcement.product.description,
      price: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(announcement.product.price),
      productUrl,
      imageUrl: announcement.product.image
        ? new URL(announcement.product.image, appUrl("/")).toString()
        : null,
      unsubscribeUrl: appUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`),
    })

    try {
      const providerEmailId = await sendNewsletterEmail({
        to: subscriber.email,
        ...email,
        idempotencyKey: `kalpanika-announcement-${delivery._id.toString()}`,
      })
      await deliveries.updateOne(
        { _id: delivery._id, status: "processing" },
        {
          $set: { status: "sent", providerEmailId, sentAt: new Date(), updatedAt: new Date() },
          $unset: { leaseUntil: "", lastError: "" },
        },
      )
    } catch (error) {
      const attempt = delivery.attempts + 1
      const retryable = !(error instanceof NewsletterEmailError) || error.retryable
      const terminal = !retryable || attempt >= MAX_DELIVERY_ATTEMPTS
      const message = error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed."
      await deliveries.updateOne(
        { _id: delivery._id, status: "processing" },
        {
          $set: {
            status: terminal ? "failed" : "pending",
            lastError: message,
            nextAttemptAt: terminal ? new Date() : new Date(Date.now() + retryDelay(attempt)),
            updatedAt: new Date(),
          },
          $unset: { leaseUntil: "" },
        },
      )
    }
    await wait(550)
  }
}

async function finalizeAnnouncement(
  database: Awaited<ReturnType<typeof getDatabase>>,
  announcement: NewsletterAnnouncementDocument,
) {
  if (!announcement.recipientSnapshotComplete) return
  const deliveries = database.collection<NewsletterDeliveryDocument>("newsletterAnnouncementDeliveries")
  const [totalRecipients, sentCount, failedCount, activeCount] = await Promise.all([
    deliveries.countDocuments({ announcementId: announcement._id }),
    deliveries.countDocuments({ announcementId: announcement._id, status: "sent" }),
    deliveries.countDocuments({ announcementId: announcement._id, status: "failed" }),
    deliveries.countDocuments({ announcementId: announcement._id, status: { $in: ["pending", "processing"] } }),
  ])
  const now = new Date()
  await database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements").updateOne(
    { _id: announcement._id },
    {
      $set: {
        sentCount,
        failedCount,
        totalRecipients,
        status: activeCount === 0 ? (failedCount > 0 && sentCount === 0 ? "failed" : "completed") : "pending",
        updatedAt: now,
        ...(activeCount === 0 ? { completedAt: now } : {}),
      },
      $unset: { leaseUntil: "" },
    },
  )
}

export async function processNewsletterQueue() {
  validateNewsletterEmailConfiguration()
  const database = await getDatabase()
  await recoverMissedAnnouncements()
  const announcements = database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements")
  const announcement = await claimAnnouncement(announcements, new Date())
  if (!announcement) return { processedEvents: 0 }

  const product = await database.collection<ProductDocument>("products").findOne({ _id: announcement.productId })
  const currentCategory = product
    ? await database.collection<CategoryDocument>("categories").findOne({ _id: product.categoryId })
    : null
  if (
    !product
    || !product.active
    || product.archived
    || !currentCategory?.active
    || product.adminHistory?.some((entry) =>
      entry.field === "visibility" && entry.to === false && entry.updatedAt >= announcement.createdAt,
    )
  ) {
    await announcements.updateOne(
      { _id: announcement._id },
      {
        $set: {
          status: "failed",
          failedCount: 0,
          completedAt: new Date(),
          updatedAt: new Date(),
          error: "Product was unpublished before its announcement could be delivered.",
        },
        $unset: { leaseUntil: "" },
      },
    )
    return { processedEvents: 1 }
  }

  if (!announcement.recipientSnapshotComplete) {
    await createRecipientSnapshot(database, announcement)
    return { processedEvents: 1 }
  }

  await processDeliveryBatch(database, announcement)
  const latest = await announcements.findOne({ _id: announcement._id })
  if (latest) await finalizeAnnouncement(database, latest)

  return { processedEvents: 1 }
}
