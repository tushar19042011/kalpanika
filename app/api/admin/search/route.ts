import { clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { escapeRegex } from "@/lib/catalog"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, OrderDocument, ProductDocument } from "@/lib/store-models"

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? ""
    if (!query) return NextResponse.json({ products: [], categories: [], orders: [], customers: [] })

    const regex = new RegExp(escapeRegex(query), "i")
    const database = await getDatabase()
    const matchingCategories = await database.collection<CategoryDocument>("categories")
      .find({ $or: [{ name: regex }, { description: regex }, { slug: regex }] })
      .project({ _id: 1 })
      .toArray()
    const [categories, products, orders, users] = await Promise.all([
      database.collection<CategoryDocument>("categories")
        .find({ _id: { $in: matchingCategories.map((category) => category._id) } })
        .sort({ priority: 1, name: 1 }).limit(5).toArray(),
      database.collection<ProductDocument>("products")
        .find({ archived: { $ne: true }, $or: [
          { name: regex },
          { description: regex },
          { sku: regex },
          { categoryId: { $in: matchingCategories.map((category) => category._id) } },
        ] })
        .sort({ updatedAt: -1 }).limit(5).toArray(),
      database.collection<OrderDocument>("orders")
        .find({ $or: [
          { orderId: regex },
          { "customer.firstName": regex },
          { "customer.lastName": regex },
          { "customer.email": regex },
          { "customer.phone": regex },
        ] })
        .sort({ createdAt: -1 }).limit(5).toArray(),
      (await clerkClient()).users.getUserList({ query, limit: 5, orderBy: "-created_at" }),
    ])

    return NextResponse.json({
      categories: categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        detail: `${category.slug} · ${category.active ? "Active" : "Inactive"}`,
      })),
      products: products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        detail: product.sku,
        categoryId: product.categoryId.toString(),
      })),
      orders: orders.map((order) => ({
        id: order.orderId,
        name: order.orderId,
        detail: `${order.customer.firstName} ${order.customer.lastName} · ${order.customer.email}`.trim(),
      })),
      customers: users.data.map((user) => ({
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Customer",
        detail: user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ?? "",
      })),
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not search admin records.", error)
    return NextResponse.json(
      { error: databaseErrorMessage(error, "Admin search is temporarily unavailable.") },
      { status: 503 },
    )
  }
}
