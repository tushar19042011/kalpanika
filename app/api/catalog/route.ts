import { NextResponse } from "next/server"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import { escapeRegex, toCatalogProduct, toProductCategory } from "@/lib/catalog"
import { applyCatalogDiscounts } from "@/lib/pricing"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"
import { ObjectId, type Sort } from "mongodb"

export async function GET(request: Request) {
  try {
    const database = await getDatabase()
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("q") ?? "").trim().slice(0, 100)
    const categorySlug = (searchParams.get("category") ?? "").trim()
    const requestedSlugs = (searchParams.get("slugs") ?? "")
      .split(",")
      .filter((slug) => /^[a-z0-9-]{1,140}$/.test(slug))
      .slice(0, 100)
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const limit = Math.min(1000, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "24", 10) || 24))
    const sort = searchParams.get("sort")
    const minPriceValue = searchParams.get("minPrice")
    const maxPriceValue = searchParams.get("maxPrice")
    const minPrice = minPriceValue === null ? null : Number(minPriceValue)
    const maxPrice = maxPriceValue === null ? null : Number(maxPriceValue)
    const inStock = searchParams.get("inStock") === "true"
    const categoryCollection = database.collection<CategoryDocument>("categories")
    const productCollection = database.collection<ProductDocument>("products")
    const categoryDocuments = await categoryCollection.find({ active: true }).sort({ priority: 1, name: 1 }).toArray()
    const categoryIds = categoryDocuments.map((category) => category._id)
    const categoryById = new Map(categoryDocuments.map((category) => [category._id.toString(), category]))
    const category = categorySlug
      ? categoryDocuments.find((item) => item.slug === categorySlug)
      : undefined

    const filter: Record<string, unknown> = {
      active: true,
      categoryId: category ? category._id : { $in: categoryIds },
    }
    if (categorySlug && !category) {
      return NextResponse.json({ products: [], categories: [], total: 0, page, pages: 0 })
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i")
      const matchingCategories = categoryDocuments
        .filter((item) => regex.test(item.name) || regex.test(item.description))
        .map((item) => item._id)
      filter.$or = [
        { name: regex },
        { description: regex },
        { sku: regex },
        ...(matchingCategories.length ? [{ categoryId: { $in: matchingCategories } }] : []),
      ]
    }
    if (requestedSlugs.length) filter.slug = { $in: requestedSlugs }
    if (minPriceValue !== null || maxPriceValue !== null) {
      if ((minPriceValue !== null && (!Number.isFinite(minPrice) || minPrice! < 0))
        || (maxPriceValue !== null && (!Number.isFinite(maxPrice) || maxPrice! < 0))
        || (minPrice !== null && maxPrice !== null && minPrice > maxPrice)) {
        return NextResponse.json({ error: "Enter a valid product price range." }, { status: 400 })
      }
      filter.price = {
        ...(minPrice !== null ? { $gte: minPrice } : {}),
        ...(maxPrice !== null ? { $lte: maxPrice } : {}),
      }
    }
    if (inStock) filter.stock = { $gt: 0 }

    const sortOrder: Sort = sort === "price-asc"
      ? { price: 1 as const, _id: 1 as const }
      : sort === "price-desc"
        ? { price: -1 as const, _id: 1 as const }
        : sort === "newest"
          ? { createdAt: -1 as const }
          : { featured: -1 as const, createdAt: -1 as const }
    const total = await productCollection.countDocuments(filter)
    const productDocuments = await productCollection.find(filter)
      .sort(sortOrder)
      .skip(requestedSlugs.length ? 0 : (page - 1) * limit)
      .limit(requestedSlugs.length ? 100 : limit)
      .toArray()
    const productCounts = await productCollection.aggregate<{ _id: ObjectId; count: number }>([
      { $match: { active: true, categoryId: { $in: categoryIds } } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]).toArray()
    const countsById = new Map(productCounts.map((item) => [item._id.toString(), item.count]))
    const sampleProducts = await productCollection.aggregate<{ _id: ObjectId; slug: string }>([
      { $match: { active: true, categoryId: { $in: categoryIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$categoryId", slug: { $first: "$slug" } } },
    ]).toArray()
    const sampleByCategory = new Map(sampleProducts.map((item) => [item._id.toString(), item.slug]))

    const catalogProducts = productDocuments.flatMap((product) => {
        const productCategory = categoryById.get(product.categoryId.toString())
        return productCategory ? [toCatalogProduct(product, productCategory)] : []
      })
    const pricedProducts = await applyCatalogDiscounts(database, catalogProducts, categoryById)

    return NextResponse.json({
      products: pricedProducts,
      categories: categoryDocuments.map((item) => {
        return toProductCategory(
          item,
          countsById.get(item._id.toString()) ?? 0,
          sampleByCategory.get(item._id.toString()),
        )
      }),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("Could not load the public product catalog.", error)
    return NextResponse.json(
      { error: databaseErrorMessage(error, "The catalog is temporarily unavailable.") },
      { status: 503 },
    )
  }
}
