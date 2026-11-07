import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { fulfillmentStatuses, fulfillmentTransitions, type AdminFulfillmentStatus } from "@/lib/admin-data"
import { getDatabase } from "@/lib/mongodb"
import type { AdminAuditEntry, OrderDocument } from "@/lib/store-models"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAdmin()
    const { id } = await params
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid order update." }, { status: 400 })
    }
    if ("archived" in body) {
      if (typeof body.archived !== "boolean" || Object.keys(body).some((key) => key !== "archived")) {
        return NextResponse.json({ error: "Select a valid archive action." }, { status: 400 })
      }
      const database = await getDatabase()
      const orders = database.collection<OrderDocument>("orders")
      const current = await orders.findOne({ orderId: id })
      if (!current) return NextResponse.json({ error: "Order not found." }, { status: 404 })
      const wasArchived = current.archived === true
      if (wasArchived === body.archived) return NextResponse.json({ success: true })
      const now = new Date()
      const adminHistory: AdminAuditEntry[] = [{
        action: body.archived ? "order.archived" : "order.restored",
        field: "archived",
        from: wasArchived,
        to: body.archived,
        updatedAt: now,
        updatedBy: userId,
      }]
      const result = await orders.updateOne(
        { _id: current._id, archived: wasArchived ? true : { $ne: true } },
        { $set: { archived: body.archived, updatedAt: now }, $push: { adminHistory: { $each: adminHistory } } },
      )
      if (!result.matchedCount) return NextResponse.json({ error: "Order changed while archiving. Refresh and retry." }, { status: 409 })
      return NextResponse.json({ success: true })
    }
    if (!("status" in body)
      || typeof body.status !== "string"
      || !fulfillmentStatuses.includes(body.status as AdminFulfillmentStatus)) {
      return NextResponse.json({ error: "Select a valid fulfillment status." }, { status: 400 })
    }

    const database = await getDatabase()
    const orders = database.collection<OrderDocument>("orders")
    const order = await orders.findOne({ orderId: id })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
    const currentStatus = `${order.status[0].toUpperCase()}${order.status.slice(1)}` as AdminFulfillmentStatus
    const nextStatus = body.status as AdminFulfillmentStatus
    if (nextStatus !== currentStatus && !fulfillmentTransitions[currentStatus].includes(nextStatus)) {
      return NextResponse.json({ error: `Order cannot move from ${order.status} to ${nextStatus}.` }, { status: 409 })
    }
    if (nextStatus !== currentStatus) {
      const now = new Date()
      const adminHistory: AdminAuditEntry[] = [{
        action: "order.fulfillment.updated",
        field: "status",
        from: currentStatus,
        to: nextStatus,
        updatedAt: now,
        updatedBy: userId,
      }]
      const result = await orders.updateOne(
        { _id: order._id, status: order.status },
        {
          $set: { status: nextStatus.toLowerCase() as OrderDocument["status"], updatedAt: now },
          $push: {
            statusHistory: { status: nextStatus, updatedAt: now, updatedBy: userId },
            adminHistory: { $each: adminHistory },
          },
        },
      )
      if (!result.matchedCount) return NextResponse.json({ error: "Order changed concurrently. Refresh and retry." }, { status: 409 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    console.error("Could not update order fulfillment status.", error)
    return NextResponse.json({ error: "The order could not be updated." }, { status: 503 })
  }
}
