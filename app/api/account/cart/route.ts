import { auth } from "@clerk/nextjs/server"
import { ObjectId, type Db } from "mongodb"
import { NextResponse } from "next/server"
import { getDatabase, getMongoClient } from "@/lib/mongodb"
import type { CartDocument, CartMergeDocument, CategoryDocument, ProductDocument } from "@/lib/store-models"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function getActiveProducts(database: Db, productIds: ObjectId[]) {
  const products = await database.collection<ProductDocument>("products")
    .find({ _id: { $in: productIds }, active: true }).toArray()
  const categories = await database.collection<CategoryDocument>("categories")
    .find({ _id: { $in: products.map((product) => product.categoryId) }, active: true }, { projection: { _id: 1 } })
    .toArray()
  const activeCategoryIds = new Set(categories.map((category) => category._id.toString()))
  return products.filter((product) => activeCategoryIds.has(product.categoryId.toString()))
}

async function readCart(database: Db, clerkUserId: string) {
  const carts = database.collection<CartDocument>("carts")
  const cart = await carts.findOne({ clerkUserId })
  if (!cart?.items.length) return { items: [] }

  const products = await getActiveProducts(database, cart.items.map((item) => item.productId))
  const productsById = new Map(products.map((product) => [product._id.toString(), product]))
  const responseItems = []
  const unavailableIds: ObjectId[] = []
  const now = new Date()

  for (const item of cart.items) {
    const product = productsById.get(item.productId.toString())
    if (!product || product.stock < 1) {
      unavailableIds.push(item.productId)
      continue
    }
    const quantity = Math.min(item.quantity, product.stock, 20)
    if (quantity !== item.quantity) {
      await carts.updateOne(
        { clerkUserId, items: { $elemMatch: { productId: item.productId, quantity: item.quantity } } },
        { $set: { "items.$.quantity": quantity, updatedAt: now } },
      )
    }
    responseItems.push({
      productId: product._id.toString(),
      slug: product.slug,
      quantity,
      product: { name: product.name, price: product.price, stock: product.stock, imageUrl: product.images[0] ?? null },
    })
  }

  if (unavailableIds.length) {
    await carts.updateOne(
      { clerkUserId },
      { $pull: { items: { productId: { $in: unavailableIds } } }, $set: { updatedAt: now } },
    )
  }
  return { items: responseItems }
}

async function addQuantity(database: Db, clerkUserId: string, product: ProductDocument) {
  const carts = database.collection<CartDocument>("carts")
  const maximum = Math.min(product.stock, 20)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const cart = await carts.findOne({ clerkUserId })
    const line = cart?.items.find((item) => item.productId.equals(product._id))
    if (line) {
      if (line.quantity >= maximum) return false
      const result = await carts.updateOne(
        { clerkUserId, items: { $elemMatch: { productId: product._id, quantity: line.quantity } } },
        { $inc: { "items.$.quantity": 1 }, $set: { updatedAt: new Date() } },
      )
      if (result.matchedCount) return true
      continue
    }

    const now = new Date()
    try {
      await carts.updateOne(
        { clerkUserId, "items.productId": { $ne: product._id } },
        {
          $setOnInsert: { _id: new ObjectId(), clerkUserId, createdAt: now },
          $push: { items: { productId: product._id, quantity: 1, addedAt: now } },
          $set: { updatedAt: now },
        },
        { upsert: true },
      )
      return true
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
    }
  }
  return false
}

async function setQuantity(database: Db, clerkUserId: string, product: ProductDocument, quantity: number) {
  const carts = database.collection<CartDocument>("carts")
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = new Date()
    const cart = await carts.findOne({ clerkUserId })
    const exists = cart?.items.some((item) => item.productId.equals(product._id))
    if (exists) {
      const result = await carts.updateOne(
        { clerkUserId, "items.productId": product._id },
        { $set: { "items.$.quantity": quantity, updatedAt: now } },
      )
      if (result.matchedCount) return
      continue
    }
    try {
      await carts.updateOne(
        { clerkUserId, "items.productId": { $ne: product._id } },
        {
          $setOnInsert: { _id: new ObjectId(), clerkUserId, createdAt: now },
          $push: { items: { productId: product._id, quantity, addedAt: now } },
          $set: { updatedAt: now },
        },
        { upsert: true },
      )
      return
    } catch (error) {
      if (!isDuplicateKey(error)) throw error
    }
  }
  throw new Error("Cart changed concurrently. Retry the update.")
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    return NextResponse.json(await readCart(await getDatabase(), userId))
  } catch (error) {
    console.error("Could not load the customer cart.", error)
    return NextResponse.json({ error: "The cart is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body.action !== "string") {
      return NextResponse.json({ error: "Invalid cart update." }, { status: 400 })
    }
    if (body.expectedUserId !== userId) {
      return NextResponse.json({ error: "Your session changed. Refresh your cart and try again." }, { status: 409 })
    }

    const database = await getDatabase()
    const carts = database.collection<CartDocument>("carts")
    const now = new Date()
    if (body.action === "clear") {
      await carts.deleteOne({ clerkUserId: userId })
      return NextResponse.json({ items: [] })
    }

    if (body.action === "merge") {
      if (typeof body.mergeId !== "string" || !/^[\w-]{16,100}$/.test(body.mergeId)
        || !Array.isArray(body.items) || body.items.length > 100) {
        return NextResponse.json({ error: "Invalid guest cart." }, { status: 400 })
      }
      const guestQuantities = new Map<string, number>()
      for (const item of body.items) {
        if (!isRecord(item) || typeof item.slug !== "string" || !/^[a-z0-9-]{1,140}$/.test(item.slug)
          || typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
          return NextResponse.json({ error: "Guest cart contains an invalid product or quantity." }, { status: 400 })
        }
        const quantity = (guestQuantities.get(item.slug) ?? 0) + item.quantity
        if (quantity > 20) return NextResponse.json({ error: "A product quantity cannot exceed 20." }, { status: 400 })
        guestQuantities.set(item.slug, quantity)
      }

      const session = (await getMongoClient()).startSession()
      try {
        await session.withTransaction(async () => {
          const mergeLedger = database.collection<CartMergeDocument>("cartMerges")
          const alreadyMerged = await mergeLedger.findOne({ clerkUserId: userId, mergeId: body.mergeId as string }, { session })
          if (alreadyMerged) return

          const foundProducts = await database.collection<ProductDocument>("products")
            .find({ slug: { $in: [...guestQuantities.keys()] }, active: true }, { session }).toArray()
          const activeProducts = await getActiveProducts(database, foundProducts.map((product) => product._id))
          const cart = await carts.findOne({ clerkUserId: userId }, { session })
          const items = new Map((cart?.items ?? []).map((item) => [item.productId.toString(), item]))
          for (const product of activeProducts) {
            if (product.stock < 1) continue
            const existing = items.get(product._id.toString())
            const quantity = Math.min(20, product.stock, (existing?.quantity ?? 0) + (guestQuantities.get(product.slug) ?? 0))
            if (quantity > 0) items.set(product._id.toString(), { productId: product._id, quantity, addedAt: existing?.addedAt ?? now })
          }

          await carts.updateOne(
            { clerkUserId: userId },
            {
              $set: { items: [...items.values()], updatedAt: now },
              $setOnInsert: { _id: new ObjectId(), clerkUserId: userId, createdAt: now },
            },
            { upsert: true, session },
          )
          await mergeLedger.insertOne({ _id: new ObjectId(), clerkUserId: userId, mergeId: body.mergeId as string, createdAt: now }, { session })
        })
      } finally {
        await session.endSession()
      }
      return NextResponse.json(await readCart(database, userId))
    }

    if (typeof body.productId !== "string" || !ObjectId.isValid(body.productId)) {
      return NextResponse.json({ error: "Select a valid product." }, { status: 400 })
    }
    const productId = new ObjectId(body.productId)
    if (body.action === "remove") {
      await carts.updateOne({ clerkUserId: userId }, { $pull: { items: { productId } }, $set: { updatedAt: now } })
      return NextResponse.json(await readCart(database, userId))
    }
    if (body.action === "set" && (typeof body.quantity !== "number"
      || !Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 20)) {
      return NextResponse.json({ error: "Quantity must be a whole number between 0 and 20." }, { status: 400 })
    }
    if (body.action === "set" && body.quantity === 0) {
      await carts.updateOne({ clerkUserId: userId }, { $pull: { items: { productId } }, $set: { updatedAt: now } })
      return NextResponse.json(await readCart(database, userId))
    }

    const [product] = await getActiveProducts(database, [productId])
    if (!product || product.stock < 1) {
      await carts.updateOne({ clerkUserId: userId }, { $pull: { items: { productId } }, $set: { updatedAt: now } })
      return NextResponse.json({ error: "This product is no longer available." }, { status: 409 })
    }
    if (body.action === "add") {
      if (!await addQuantity(database, userId, product)) {
        return NextResponse.json({ error: "The available stock limit has been reached." }, { status: 409 })
      }
      return NextResponse.json(await readCart(database, userId))
    }
    if (body.action === "set") {
      const quantity = body.quantity as number
      if (quantity > product.stock) return NextResponse.json({ error: "Requested quantity exceeds available stock." }, { status: 409 })
      await setQuantity(database, userId, product, quantity)
      return NextResponse.json(await readCart(database, userId))
    }
    return NextResponse.json({ error: "Unsupported cart action." }, { status: 400 })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    console.error("Could not update the customer cart.", error)
    return NextResponse.json({ error: "The cart could not be updated." }, { status: 503 })
  }
}