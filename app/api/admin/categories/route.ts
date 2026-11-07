import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"
import { escapeRegex, slugify } from "@/lib/catalog"

export async function GET() {
  try {
    await requireAdmin()
    const database = await getDatabase()
    const [categories, counts] = await Promise.all([
      database.collection<CategoryDocument>("categories").find({}).sort({ priority: 1, name: 1 }).toArray(),
      database.collection<ProductDocument>("products").aggregate<{ _id: CategoryDocument["_id"]; count: number }>([
        { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      ]).toArray(),
    ])
    const countsById = new Map(counts.map((item) => [item._id.toString(), item.count]))
    return NextResponse.json({
      categories: categories.map((category) => ({
        id: category._id.toString(),
        slug: category.slug,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        active: category.active,
        priority: category.priority,
        productCount: countsById.get(category._id.toString()) ?? 0,
        imageClass: null,
        imageBackground: "bg-[#f1ebe4]",
      })),
    })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load admin categories.", error)
    return NextResponse.json({ error: "Categories are temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid category data." }, { status: 400 })
    }
    const input = body as Record<string, unknown>
    const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : ""
    const description = typeof input.description === "string" ? input.description.trim() : ""
    const requestedPriority = input.priority
    const imageUrl = typeof input.imageUrl === "string" && input.imageUrl.trim()
      ? input.imageUrl.trim()
      : null
    if (!name || name.length > 100 || description.length > 500) {
      return NextResponse.json({ error: "Enter a category name and a description under 500 characters." }, { status: 400 })
    }
    if (requestedPriority !== undefined && (!Number.isInteger(requestedPriority) || Number(requestedPriority) < 0)) {
      return NextResponse.json({ error: "Category sort order must be a non-negative whole number." }, { status: 400 })
    }
    const dataImage = imageUrl?.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/i)
    if (imageUrl && ((!/^https?:\/\//i.test(imageUrl) && !dataImage) || imageUrl.length > 1_400_000)) {
      return NextResponse.json({ error: "Category image must be a valid image URL or a supported image under 1 MB." }, { status: 400 })
    }
    const slug = slugify(name)
    if (!slug) return NextResponse.json({ error: "Use a category name with letters or numbers." }, { status: 400 })

    const database = await getDatabase()
    const collection = database.collection<Omit<CategoryDocument, "_id">>("categories")
    const existing = await collection.findOne({
      $or: [{ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }, { slug }],
    })
    if (existing) return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 })

    const now = new Date()
    const category: Omit<CategoryDocument, "_id"> = {
      name,
      slug,
      description,
      imageUrl,
      active: true,
      priority: requestedPriority === undefined ? await collection.countDocuments({}) + 1 : Number(requestedPriority),
      createdAt: now,
      updatedAt: now,
    }
    const result = await collection.insertOne(category)
    return NextResponse.json({
      category: {
        id: result.insertedId.toString(),
        slug,
        name,
        description,
        imageUrl,
        active: true,
        priority: category.priority,
        productCount: 0,
        imageClass: null,
        imageBackground: "bg-[#f1ebe4]",
      },
    }, { status: 201 })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 })
    }
    console.error("Could not create category.", error)
    return NextResponse.json({ error: "The category could not be saved." }, { status: 503 })
  }
}
