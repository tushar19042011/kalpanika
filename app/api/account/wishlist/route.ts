import { auth } from "@clerk/nextjs/server"
import { ObjectId, type Collection, type Db } from "mongodb"
import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, ProductDocument, WishlistDocument } from "@/lib/store-models"

type WishlistActionBody = Record<string, unknown> & { action: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function addProductsToWishlist(
  wishlist: Collection<WishlistDocument>,
  clerkUserId: string,
  products: ProductDocument[],
) {
  const now = new Date()
  for (const product of products) {
    try {
      await wishlist.updateOne(
        { clerkUserId, "items.productId": { $ne: product._id } },
        {
          $setOnInsert: { _id: new ObjectId(), clerkUserId, createdAt: now },
          $push: { items: { productId: product._id, addedAt: now } },
          $set: { updatedAt: now },
        },
        { upsert: true },
      )
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
      const alreadyPresent = await wishlist.findOne({ clerkUserId, "items.productId": product._id })
      if (!alreadyPresent) throw error
    }
  }
}

async function getVisibleWishlist(database: Db, clerkUserId: string) {
  const wishlists = database.collection<WishlistDocument>("wishlists")
  const document = await wishlists.findOne({ clerkUserId })
  if (!document?.items.length) return { slugs: [] }

  const products = await database.collection<ProductDocument>("products")
    .find({ _id: { $in: document.items.map((item) => item.productId) }, active: true }).toArray()
  const categories = await database.collection<CategoryDocument>("categories")
    .find({ _id: { $in: products.map((product) => product.categoryId) }, active: true }, { projection: { _id: 1 } })
    .toArray()
  const activeCategoryIds = new Set(categories.map((category) => category._id.toString()))
  const visibleProducts = products.filter((product) => activeCategoryIds.has(product.categoryId.toString()))
  const visibleIds = new Set(visibleProducts.map((product) => product._id.toString()))
  const unavailableIds = document.items.filter((item) => !visibleIds.has(item.productId.toString())).map((item) => item.productId)
  if (unavailableIds.length) {
    await wishlists.updateOne(
      { clerkUserId },
      { $pull: { items: { productId: { $in: unavailableIds } } }, $set: { updatedAt: new Date() } },
    )
  }
  return { slugs: visibleProducts.map((product) => product.slug) }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    return NextResponse.json(await getVisibleWishlist(await getDatabase(), userId))
  } catch (error) {
    console.error("Could not load the customer wishlist.", error)
    return NextResponse.json({ error: "The wishlist is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const input: unknown = await request.json()
    if (!isRecord(input) || typeof input.action !== "string") {
      return NextResponse.json({ error: "Invalid wishlist update." }, { status: 400 })
    }
    const body = input as WishlistActionBody
    if (body.expectedUserId !== userId) {
      return NextResponse.json({ error: "Your session changed. Refresh your wishlist and try again." }, { status: 409 })
    }

    const database = await getDatabase()
    const wishlists = database.collection<WishlistDocument>("wishlists")
    if (body.action === "merge") {
      if (!Array.isArray(body.slugs) || body.slugs.length > 100
        || !body.slugs.every((slug) => typeof slug === "string" && /^[a-z0-9-]{1,140}$/.test(slug))) {
        return NextResponse.json({ error: "Guest wishlist contains invalid products." }, { status: 400 })
      }
      const slugs = [...new Set(body.slugs as string[])]
      const products = await database.collection<ProductDocument>("products")
        .find({ slug: { $in: slugs }, active: true }).toArray()
      const categories = await database.collection<CategoryDocument>("categories")
        .find({ _id: { $in: products.map((product) => product.categoryId) }, active: true }, { projection: { _id: 1 } })
        .toArray()
      const activeCategoryIds = new Set(categories.map((category) => category._id.toString()))
      await addProductsToWishlist(
        wishlists,
        userId,
        products.filter((product) => activeCategoryIds.has(product.categoryId.toString())),
      )
      return NextResponse.json(await getVisibleWishlist(database, userId))
    }

    if (typeof body.slug !== "string" || !/^[a-z0-9-]{1,140}$/.test(body.slug)
      || (body.action !== "add" && body.action !== "remove")) {
      return NextResponse.json({ error: "Invalid wishlist update." }, { status: 400 })
    }

    const product = await database.collection<ProductDocument>("products").findOne({ slug: body.slug, active: true })
    if (body.action === "add") {
      if (!product) return NextResponse.json({ error: "This product is no longer available." }, { status: 404 })
      const category = await database.collection<CategoryDocument>("categories").findOne({ _id: product.categoryId, active: true })
      if (!category) return NextResponse.json({ error: "This product is no longer available." }, { status: 404 })
      await addProductsToWishlist(wishlists, userId, [product])
    } else if (product) {
      await wishlists.updateOne(
        { clerkUserId: userId },
        { $pull: { items: { productId: product._id } }, $set: { updatedAt: new Date() } },
      )
    }
    return NextResponse.json(await getVisibleWishlist(database, userId))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    console.error("Could not update the customer wishlist.", error)
    return NextResponse.json({ error: "The wishlist could not be updated." }, { status: 503 })
  }
}
