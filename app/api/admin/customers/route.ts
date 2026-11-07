import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { OrderDocument } from "@/lib/store-models"

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const searchParams = new URL(request.url).searchParams
    const query = searchParams.get("q")?.trim().slice(0, 100) ?? ""
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50))
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0)
    const clerkUsers = await (await clerkClient()).users.getUserList({
      ...(query ? { query } : {}),
      limit,
      offset,
      orderBy: "-created_at",
    })
    const userIds = clerkUsers.data.map((user) => user.id)
    const orderSummaries = await (await getDatabase()).collection<OrderDocument>("orders")
      .aggregate<{ _id: string; orderCount: number; paidTotal: number; lastOrderAt: Date }>([
        { $match: { clerkUserId: { $in: userIds } } },
        { $group: {
          _id: "$clerkUserId",
          orderCount: { $sum: 1 },
          paidTotal: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0] } },
          lastOrderAt: { $max: "$createdAt" },
        } },
      ]).toArray()
    const summaryByUser = new Map(orderSummaries.map((summary) => [summary._id, summary]))
    return NextResponse.json({
      customers: clerkUsers.data.map((user) => {
        const summary = summaryByUser.get(user.id)
        return {
          id: user.id,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Customer",
          username: user.username,
          email: user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ?? "",
          createdAt: new Date(user.createdAt).toISOString(),
          orderCount: summary?.orderCount ?? 0,
          paidTotal: summary?.paidTotal ?? 0,
          lastOrderAt: summary?.lastOrderAt?.toISOString() ?? null,
        }
      }),
      totalCount: clerkUsers.totalCount,
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load admin customers.", error)
    return NextResponse.json({ error: "Customer records are temporarily unavailable." }, { status: 503 })
  }
}
