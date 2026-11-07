import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, OrderDocument, ProductDocument } from "@/lib/store-models"
import type { AdminFulfillmentStatus, AdminOrder, AdminProduct } from "@/lib/admin-data"

export async function GET() {
  try {
    await requireAdmin()
    const database = await getDatabase()
    const [categories, products, orders] = await Promise.all([
      database.collection<CategoryDocument>("categories").find({}).sort({ priority: 1, name: 1 }).toArray(),
      database.collection<ProductDocument>("products").find({ archived: { $ne: true } }).sort({ updatedAt: -1 }).limit(500).toArray(),
      database.collection<OrderDocument>("orders").find({}).sort({ createdAt: -1 }).limit(500).toArray(),
    ])
    const categoryById = new Map(categories.map((category) => [category._id.toString(), category]))

    return NextResponse.json({
      categories: categories.map((category) => ({
        id: category._id.toString(),
        slug: category.slug,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        active: category.active,
        priority: category.priority,
        productCount: products.filter(
          (product) => product.categoryId.equals(category._id) && product.active,
        ).length,
        imageClass: null,
        imageBackground: "bg-[#f1ebe4]",
      })),
      products: products.map((product): AdminProduct => ({
        id: product._id.toString(),
        name: product.name,
        description: product.description,
        sku: product.sku,
        category: categoryById.get(product.categoryId.toString())?.name ?? "Unavailable category",
        categoryId: product.categoryId.toString(),
        images: product.images,
        featured: product.featured,
        price: product.price,
        taxRate: product.taxRate ?? null,
        stock: product.stock,
        status: product.active ? "Active" : "Inactive",
        updated: product.updatedAt.toLocaleDateString("en-IN"),
      })),
      orders: orders.map((order): AdminOrder => ({
        id: order.orderId,
        customer: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
        email: order.customer.email,
        date: order.createdAt.toLocaleDateString("en-IN"),
        createdAt: order.createdAt.toISOString(),
        items: order.items.reduce((count, item) => count + item.quantity, 0),
        itemSnapshots: order.items.map((item) => ({
          name: item.name,
          category: item.category,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        subtotal: order.subtotal,
        shippingCharge: order.shippingCharge,
        total: order.total,
        payment: order.paymentStatus === "paid" ? "Paid"
          : order.paymentStatus === "failed" ? "Failed"
            : order.paymentStatus === "refunded" ? "Refunded" : "Pending",
        status: order.status[0].toUpperCase() + order.status.slice(1) as AdminFulfillmentStatus,
        archived: order.archived === true,
      })),
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load admin data.", error)
    return NextResponse.json({ error: databaseErrorMessage(error, "Admin data is temporarily unavailable.") }, { status: 503 })
  }
}
