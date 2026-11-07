import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { OrderDocument } from "@/lib/store-models"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const orders = await (await getDatabase()).collection<OrderDocument>("orders")
      .find({ clerkUserId: userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    return NextResponse.json({
      orders: orders.map((order) => ({
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      })),
    })
  } catch (error) {
    console.error("Could not load customer orders.", error)
    return NextResponse.json({ error: "Order history is temporarily unavailable." }, { status: 503 })
  }
}
