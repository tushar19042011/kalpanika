import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { slugify } from "@/lib/catalog"
import { getDatabase } from "@/lib/mongodb"
import { enqueueProductAnnouncement } from "@/lib/newsletter-announcements"
import { validateProduct } from "@/lib/product-validation"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const validation = validateProduct(await request.json())
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const database = await getDatabase()
    const category = await database.collection<CategoryDocument>("categories")
      .findOne({ _id: validation.data.categoryId, active: true })
    if (!category) return NextResponse.json({ error: "Select an active category." }, { status: 400 })

    const products = database.collection<ProductDocument>("products")
    if (await products.findOne({ sku: validation.data.sku })) {
      return NextResponse.json({ error: "A product with this SKU already exists." }, { status: 409 })
    }
    const id = new ObjectId()
    const baseSlug = slugify(validation.data.name)
    if (!baseSlug) return NextResponse.json({ error: "Product name must contain letters or numbers." }, { status: 400 })
    const slug = await products.findOne({ slug: baseSlug })
      ? `${baseSlug}-${id.toHexString().slice(-6)}`
      : baseSlug
    const now = new Date()
    const product: Omit<ProductDocument, "_id"> = {
      ...validation.data,
      slug,
      ...(validation.data.active
        ? { announcementEligibleAt: now, announcementQueueStatus: "pending" as const }
        : {}),
      createdAt: now,
      updatedAt: now,
    }
    await products.insertOne({ ...product, _id: id })
    let announcementQueued = false
    if (validation.data.active) {
      try {
        await enqueueProductAnnouncement(database, { ...product, _id: id }, category)
        announcementQueued = true
      } catch (error) {
        console.error("New product was saved, but its newsletter announcement could not be queued yet.", error)
      }
    }
    return NextResponse.json({ id: id.toString(), slug, announcementQueued }, { status: 201 })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "A product with this SKU or URL already exists." }, { status: 409 })
    }
    console.error("Could not create product.", error)
    return NextResponse.json({ error: "The product could not be saved." }, { status: 503 })
  }
}
