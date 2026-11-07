import { auth } from "@clerk/nextjs/server"
import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { databaseErrorMessage, getDatabase, getMongoClient } from "@/lib/mongodb"
import type { CategoryDocument, OrderDocument, ProductDocument } from "@/lib/store-models"

class OutOfStockError extends Error {
  constructor() {
    super("One or more products no longer have enough stock.")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : ""
}

function orderResponse(order: OrderDocument) {
  return {
    orderId: order.orderId,
    paymentStatus: order.paymentStatus,
    status: order.status,
    subtotal: order.subtotal,
    shippingCharge: order.shippingCharge,
    discount: order.discount,
    total: order.total,
    items: order.items.map((item) => ({
      slug: item.slug,
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    })),
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

    const idempotencyKey = request.headers.get("Idempotency-Key") ?? ""
    if (!/^[\w-]{16,100}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: "Submit the order again to start a new checkout." }, { status: 400 })
    }
    const body: unknown = await request.json()
    if (!isRecord(body) || !isRecord(body.customer) || !isRecord(body.shipping)) {
      return NextResponse.json({ error: "Invalid checkout details." }, { status: 400 })
    }
    const inputLines: unknown[] = Array.isArray(body.items) ? body.items : []
    if (inputLines.length === 0 || inputLines.length > 20) {
      return NextResponse.json({ error: "Your bag is empty or contains too many products." }, { status: 400 })
    }
    const quantities = new Map<string, number>()
    for (const value of inputLines) {
      if (!isRecord(value) || typeof value.slug !== "string"
        || !/^[a-z0-9-]{1,140}$/.test(value.slug)
        || typeof value.quantity !== "number" || !Number.isInteger(value.quantity) || value.quantity < 1) {
        return NextResponse.json({ error: "Your bag contains an invalid product or quantity." }, { status: 400 })
      }
      const quantity = (quantities.get(value.slug) ?? 0) + value.quantity
      if (quantity > 20) {
        return NextResponse.json({ error: "A product quantity cannot exceed 20." }, { status: 400 })
      }
      quantities.set(value.slug, quantity)
    }

    const customer = {
      firstName: cleanText(body.customer.firstName, 80),
      lastName: cleanText(body.customer.lastName, 80),
      email: cleanText(body.customer.email, 254).toLowerCase(),
      phone: cleanText(body.customer.phone, 20),
    }
    const shipping = {
      address: cleanText(body.shipping.address, 200),
      landmark: cleanText(body.shipping.landmark, 200),
      city: cleanText(body.shipping.city, 100),
      state: cleanText(body.shipping.state, 100),
      pin: cleanText(body.shipping.pin, 6),
      country: cleanText(body.shipping.country, 100),
    }
    if (!customer.firstName || !customer.lastName
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)
      || !/^\+?[0-9\s-]{10,18}$/.test(customer.phone)) {
      return NextResponse.json({ error: "Please provide valid contact details." }, { status: 400 })
    }
    if (!shipping.address || !shipping.city || !shipping.state
      || !/^\d{6}$/.test(shipping.pin) || !shipping.country) {
      return NextResponse.json({ error: "Please complete your shipping address with a valid PIN code." }, { status: 400 })
    }
    if (!["upi", "card", "netbanking"].includes(String(body.paymentMethod))) {
      return NextResponse.json({ error: "Select a supported payment method." }, { status: 400 })
    }

    const database = await getDatabase()
    const orders = database.collection<OrderDocument>("orders")
    const existing = await orders.findOne({ idempotencyKey, clerkUserId: userId })
    if (existing) return NextResponse.json(orderResponse(existing))

    const mongoClient = await getMongoClient()
    const session = mongoClient.startSession()
    let createdOrder: OrderDocument | null = null
    try {
      await session.withTransaction(async () => {
        const products = database.collection<ProductDocument>("products")
        const categories = database.collection<CategoryDocument>("categories")
        const snapshots = []
        for (const [slug, quantity] of quantities) {
          const product = await products.findOne({ slug, active: true }, { session })
          if (!product) throw new OutOfStockError()
          const category = await categories.findOne({ _id: product.categoryId, active: true }, { session })
          if (!category) throw new OutOfStockError()
          const updated = await products.updateOne(
            { _id: product._id, active: true, stock: { $gte: quantity } },
            { $inc: { stock: -quantity }, $set: { updatedAt: new Date() } },
            { session },
          )
          if (!updated.matchedCount) throw new OutOfStockError()
          snapshots.push({
            productId: product._id,
            slug: product.slug,
            name: product.name,
            category: category.name,
            sku: product.sku,
            price: product.price,
            quantity,
            image: product.images[0] ?? null,
          })
        }

        const subtotal = snapshots.reduce((sum, item) => sum + item.price * item.quantity, 0)
        const now = new Date()
        createdOrder = {
          _id: new ObjectId(),
          orderId: `KLP-${new ObjectId().toHexString().toUpperCase()}`,
          idempotencyKey,
          clerkUserId: userId,
          customer,
          shipping,
          items: snapshots,
          subtotal,
          shippingCharge: 0,
          discount: 0,
          total: subtotal,
          paymentMethod: String(body.paymentMethod),
          paymentStatus: "pending",
          status: "confirmed",
          createdAt: now,
          updatedAt: now,
          statusHistory: [{ status: "confirmed", updatedAt: now, updatedBy: userId }],
        }
        await orders.insertOne(createdOrder, { session })
      })
    } finally {
      await session.endSession()
    }
    if (!createdOrder) throw new Error("Order transaction completed without creating an order.")
    return NextResponse.json(orderResponse(createdOrder), { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    if (error instanceof OutOfStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      console.error("Duplicate order submission detected.", error)
      return NextResponse.json({ error: "This checkout has already been submitted." }, { status: 409 })
    }
    console.error("Could not create order.", error)
    return NextResponse.json({ error: databaseErrorMessage(error, "Unable to create the order right now.") }, { status: 503 })
  }
}
