import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { NewsletterDeliveryDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Announcement not found." }, { status: 404 })
    const page = Math.max(1, Math.min(10_000, Number.parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10) || 1))
    const announcementId = new ObjectId(id)
    const collection = (await getDatabase()).collection<NewsletterDeliveryDocument>("newsletterAnnouncementDeliveries")
    const [deliveries, totalCount] = await Promise.all([
      collection.find({ announcementId })
        .project({ email: 1, status: 1, attempts: 1, lastError: 1, providerEmailId: 1, sentAt: 1, updatedAt: 1 })
        .sort({ createdAt: 1 })
        .skip((page - 1) * 50)
        .limit(50)
        .toArray(),
      collection.countDocuments({ announcementId }),
    ])
    return NextResponse.json({
      deliveries: deliveries.map((delivery) => ({
        id: delivery._id.toString(),
        email: delivery.email,
        status: delivery.status,
        attempts: delivery.attempts,
        error: delivery.lastError ?? null,
        providerEmailId: delivery.providerEmailId ?? null,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        updatedAt: delivery.updatedAt.toISOString(),
      })),
      page,
      pageCount: Math.max(1, Math.ceil(totalCount / 50)),
      totalCount,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load newsletter delivery details.", error)
    return NextResponse.json({ error: "Delivery details are temporarily unavailable." }, { status: 503 })
  }
}
