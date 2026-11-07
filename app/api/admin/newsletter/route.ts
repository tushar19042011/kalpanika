import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { escapeRegex } from "@/lib/catalog"
import { getDatabase } from "@/lib/mongodb"
import type { NewsletterAnnouncementDocument, NewsletterSubscriptionDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const database = await getDatabase()
    const params = new URL(request.url).searchParams
    const view = params.get("view") ?? "overview"

    if (view === "overview") {
      const subscribers = database.collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
      const announcements = database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements")
      const [totalSubscribers, verifiedSubscribers, pendingConfirmation, unsubscribed, announcementCount, deliveryStats] = await Promise.all([
        subscribers.countDocuments({}),
        subscribers.countDocuments({ status: "subscribed", verifiedAt: { $type: "date" } }),
        subscribers.countDocuments({
          $or: [
            { status: "pending" },
            { status: "subscribed", verifiedAt: { $exists: false } },
          ],
        }),
        subscribers.countDocuments({ status: "unsubscribed" }),
        announcements.countDocuments({}),
        announcements.aggregate<{ sent: number; failed: number }>([
          { $group: { _id: null, sent: { $sum: "$sentCount" }, failed: { $sum: "$failedCount" } } },
        ]).next(),
      ])
      return NextResponse.json({
        overview: {
          totalSubscribers,
          verifiedSubscribers,
          pendingConfirmation,
          unsubscribed,
          announcementCount,
          sentCount: deliveryStats?.sent ?? 0,
          failedCount: deliveryStats?.failed ?? 0,
        },
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1))
    const limit = 25
    if (view === "subscribers") {
      const query = params.get("q")?.trim().slice(0, 100) ?? ""
      const status = params.get("status") ?? ""
      const filter: Record<string, unknown> = {}
      if (query) filter.normalizedEmail = new RegExp(escapeRegex(query.toLowerCase()), "i")
      if (status === "active") {
        filter.status = "subscribed"
        filter.verifiedAt = { $type: "date" }
      } else if (status === "pending") {
        filter.$or = [
          { status: "pending" },
          { status: "subscribed", verifiedAt: { $exists: false } },
        ]
      } else if (status === "unsubscribed") {
        filter.status = "unsubscribed"
      } else if (status) {
        return NextResponse.json({ error: "Select a valid subscriber status." }, { status: 400 })
      }

      const collection = database.collection<NewsletterSubscriptionDocument>("newsletterSubscriptions")
      const [subscribers, totalCount] = await Promise.all([
        collection.find(filter)
          .project({
            email: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            verifiedAt: 1,
            subscribedAt: 1,
            unsubscribedAt: 1,
          })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        collection.countDocuments(filter),
      ])
      return NextResponse.json({
        subscribers: subscribers.map((subscriber) => ({
          id: subscriber._id.toString(),
          email: subscriber.email,
          status: subscriber.status === "subscribed" && !subscriber.verifiedAt ? "pending" : subscriber.status,
          createdAt: subscriber.createdAt.toISOString(),
          updatedAt: subscriber.updatedAt.toISOString(),
          verifiedAt: subscriber.verifiedAt?.toISOString() ?? null,
          subscribedAt: subscriber.subscribedAt?.toISOString() ?? null,
          unsubscribedAt: subscriber.unsubscribedAt?.toISOString() ?? null,
        })),
        page,
        totalCount,
        pageCount: Math.max(1, Math.ceil(totalCount / limit)),
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    if (view === "announcements") {
      const collection = database.collection<NewsletterAnnouncementDocument>("newsletterAnnouncements")
      const [announcements, totalCount] = await Promise.all([
        collection.find({})
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
        collection.countDocuments({}),
      ])
      return NextResponse.json({
        announcements: announcements.map((announcement) => ({
          id: announcement._id.toString(),
          productId: announcement.productId.toString(),
          product: announcement.product,
          status: announcement.status,
          totalRecipients: announcement.totalRecipients,
          sentCount: announcement.sentCount,
          failedCount: announcement.failedCount,
          error: announcement.error ?? null,
          createdAt: announcement.createdAt.toISOString(),
          completedAt: announcement.completedAt?.toISOString() ?? null,
        })),
        page,
        totalCount,
        pageCount: Math.max(1, Math.ceil(totalCount / limit)),
      }, { headers: { "Cache-Control": "private, no-store" } })
    }

    return NextResponse.json({ error: "Select a valid newsletter view." }, { status: 400 })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load newsletter administration data.", error)
    return NextResponse.json({ error: "Newsletter data is temporarily unavailable." }, { status: 503 })
  }
}
