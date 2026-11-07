import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { OrderDocument } from "@/lib/store-models"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const user = await (await clerkClient()).users.getUser(id)
    const orders = await (await getDatabase()).collection<OrderDocument>("orders")
      .find({ clerkUserId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    return NextResponse.json({
      customer: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Customer",
        username: user.username,
        email: user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ?? "",
        createdAt: new Date(user.createdAt).toISOString(),
      },
      orders: orders.map((order) => ({
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
        })),
      })),
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (typeof error === "object" && error !== null && "status" in error && error.status === 404) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 })
    }
    console.error("Could not load admin customer details.", error)
    return NextResponse.json({ error: "Customer details are temporarily unavailable." }, { status: 503 })
  }
}
