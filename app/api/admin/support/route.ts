import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { escapeRegex } from "@/lib/catalog"
import { getDatabase } from "@/lib/mongodb"
import type { SupportRequestDocument, SupportRequestStatus } from "@/lib/store-models"

export const dynamic = "force-dynamic"

const statuses: SupportRequestStatus[] = ["new", "in_progress", "resolved"]

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const searchParams = new URL(request.url).searchParams
    const query = searchParams.get("q")?.trim().slice(0, 100) ?? ""
    const requestedStatus = searchParams.get("status")
    if (requestedStatus && !statuses.includes(requestedStatus as SupportRequestStatus)) {
      return NextResponse.json({ error: "Select a valid request status." }, { status: 400 })
    }

    const filter: Record<string, unknown> = {}
    if (requestedStatus) filter.status = requestedStatus
    if (query) {
      const regex = new RegExp(escapeRegex(query), "i")
      filter.$or = [{ name: regex }, { email: regex }, { orderNumber: regex }, { message: regex }]
    }
    const requests = await (await getDatabase()).collection<SupportRequestDocument>("supportRequests")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    return NextResponse.json({
      requests: requests.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        email: item.email,
        orderNumber: item.orderNumber,
        message: item.message,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        statusHistory: item.statusHistory.map((entry) => ({
          status: entry.status,
          updatedAt: entry.updatedAt.toISOString(),
        })),
      })),
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load admin support requests.", error)
    return NextResponse.json({ error: "Support requests are temporarily unavailable." }, { status: 503 })
  }
}
