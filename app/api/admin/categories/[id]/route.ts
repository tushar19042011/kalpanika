import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { escapeRegex, slugify } from "@/lib/catalog"
import { getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"

function validImageUrl(value: unknown): value is string | null {
  if (value === null || value === "") return true
  if (typeof value !== "string" || value.length > 1_400_000) return false
  const dataImage = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value)
  return /^https?:\/\//i.test(value) || dataImage
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid category data." }, { status: 400 })
    }

    const body = input as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
    const description = typeof body.description === "string" ? body.description.trim() : ""
    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null
    if (!name || name.length > 100 || description.length > 500 || !validImageUrl(imageUrl)) {
      return NextResponse.json({ error: "Enter a category name, a description under 500 characters, and a valid image URL." }, { status: 400 })
    }
    if (typeof body.active !== "boolean" || !Number.isInteger(body.priority) || Number(body.priority) < 0) {
      return NextResponse.json({ error: "Select a valid category status and sort order." }, { status: 400 })
    }

    const slug = slugify(name)
    if (!slug) return NextResponse.json({ error: "Use a category name with letters or numbers." }, { status: 400 })
    const database = await getDatabase()
    const categories = database.collection<CategoryDocument>("categories")
    const categoryId = new ObjectId(id)
    const [current, duplicate] = await Promise.all([
      categories.findOne({ _id: categoryId }),
      categories.findOne({
        _id: { $ne: categoryId },
        $or: [
          { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
          { slug },
        ],
      }),
    ])
    if (!current) return NextResponse.json({ error: "Category not found." }, { status: 404 })
    if (duplicate) return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 })

    const updatedAt = new Date()
    await categories.updateOne(
      { _id: categoryId },
      { $set: { name, slug, description, imageUrl, active: body.active, priority: Number(body.priority), updatedAt } },
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 })
    }
    console.error("Could not update category.", error)
    return NextResponse.json({ error: "The category could not be updated." }, { status: 503 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Category not found." }, { status: 404 })
    const database = await getDatabase()
    const categoryId = new ObjectId(id)
    const category = await database.collection<CategoryDocument>("categories").findOne({ _id: categoryId })
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 })
    const productCount = await database.collection<ProductDocument>("products").countDocuments({ categoryId })
    if (productCount > 0) {
      return NextResponse.json({
        error: `This category is used by ${productCount} product${productCount === 1 ? "" : "s"}. Deactivate it instead to preserve product references.`,
      }, { status: 409 })
    }
    await database.collection<CategoryDocument>("categories").deleteOne({ _id: categoryId })
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not delete category.", error)
    return NextResponse.json({ error: "The category could not be deleted." }, { status: 503 })
  }
}
