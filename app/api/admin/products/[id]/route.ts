import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { slugify } from "@/lib/catalog"
import { getDatabase } from "@/lib/mongodb"
import type { AdminProduct } from "@/lib/admin-data"
import type { AdminAuditEntry, CategoryDocument, ProductDocument } from "@/lib/store-models"
import { validateProduct } from "@/lib/product-validation"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    const database = await getDatabase()
    const product = await database.collection<ProductDocument>("products")
      .findOne({ _id: new ObjectId(id), archived: { $ne: true } })
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    const category = await database.collection<CategoryDocument>("categories").findOne({ _id: product.categoryId })
    const result: AdminProduct = {
      id: product._id.toString(),
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: category?.name ?? "Unavailable category",
      categoryId: product.categoryId.toString(),
      images: product.images,
      featured: product.featured,
      price: product.price,
      taxRate: product.taxRate ?? null,
      stock: product.stock,
      status: product.active ? "Active" : "Inactive",
      updated: product.updatedAt.toLocaleDateString("en-IN"),
    }
    return NextResponse.json({ product: result })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load product details for admin.", error)
    return NextResponse.json({ error: "Product details are temporarily unavailable." }, { status: 503 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    const validation = validateProduct(await request.json())
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const database = await getDatabase()
    const category = await database.collection<CategoryDocument>("categories")
      .findOne({ _id: validation.data.categoryId, active: true })
    if (!category) return NextResponse.json({ error: "Select an active category." }, { status: 400 })
    const products = database.collection<ProductDocument>("products")
    const current = await products.findOne({ _id: new ObjectId(id) })
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    if (await products.findOne({ _id: { $ne: current._id }, sku: validation.data.sku })) {
      return NextResponse.json({ error: "A product with this SKU already exists." }, { status: 409 })
    }
    const baseSlug = slugify(validation.data.name)
    if (!baseSlug) return NextResponse.json({ error: "Product name must contain letters or numbers." }, { status: 400 })
    const conflictingSlug = await products.findOne({ _id: { $ne: current._id }, slug: baseSlug })
    const slug = conflictingSlug ? `${baseSlug}-${current._id.toHexString().slice(-6)}` : baseSlug
    const now = new Date()
    const adminHistory: AdminAuditEntry[] = []
    if (current.active !== validation.data.active) {
      adminHistory.push({ action: "product.updated", field: "visibility", from: current.active, to: validation.data.active, updatedAt: now, updatedBy: userId })
    }
    if (current.stock !== validation.data.stock) {
      adminHistory.push({ action: "product.updated", field: "stock", from: current.stock, to: validation.data.stock, updatedAt: now, updatedBy: userId })
    }
    await products.updateOne(
      { _id: current._id },
      { $set: { ...validation.data, slug, updatedAt: now }, $push: { adminHistory: { $each: adminHistory } } },
    )
    return NextResponse.json({ id, slug })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    console.error("Could not update product.", error)
    return NextResponse.json({ error: "The product could not be updated." }, { status: 503 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    const products = (await getDatabase()).collection<ProductDocument>("products")
    const productId = new ObjectId(id)
    const current = await products.findOne({ _id: productId })
    if (!current) return NextResponse.json({ error: "Product not found." }, { status: 404 })
    if (current.archived) return NextResponse.json({ success: true })
    const now = new Date()
    const adminHistory: AdminAuditEntry[] = [
      { action: "product.archived", field: "archived", from: false, to: true, updatedAt: now, updatedBy: userId },
    ]
    if (current.active) {
      adminHistory.push({ action: "product.archived", field: "visibility", from: true, to: false, updatedAt: now, updatedBy: userId })
    }
    const result = await products.updateOne(
      { _id: productId, archived: { $ne: true } },
      { $set: { active: false, archived: true, updatedAt: now }, $push: { adminHistory: { $each: adminHistory } } },
    )
    if (!result.matchedCount) return NextResponse.json({ error: "Product changed while archiving. Refresh and retry." }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not deactivate product.", error)
    return NextResponse.json({ error: "The product could not be removed from the catalog." }, { status: 503 })
  }
}
