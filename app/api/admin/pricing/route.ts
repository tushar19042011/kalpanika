import { randomUUID } from "node:crypto"
import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import { emptyPricingSettings } from "@/lib/pricing"
import type { CategoryDocument, PricingCouponDocument, PricingDiscountDocument, PricingRedemptionDocument, PricingSettingsDocument, ProductDocument } from "@/lib/store-models"

export const dynamic = "force-dynamic"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function limitOrNull(value: unknown) {
  const parsed = numberOrNull(value)
  return parsed === null || (parsed !== undefined && Number.isInteger(parsed) && parsed > 0) ? parsed : undefined
}

function objectIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 200
    || !value.every((item) => typeof item === "string" && ObjectId.isValid(item))) return undefined
  return [...new Map(value.map((item) => [String(item), new ObjectId(String(item))])).values()]
}

function validDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

async function parseDiscount(input: Record<string, unknown>, id: ObjectId | null) {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : ""
  const type = input.type
  const target = input.target
  const value = Number(input.value)
  const startsAt = validDate(input.startsAt)
  const endsAt = validDate(input.endsAt)
  const minimumOrderValue = numberOrNull(input.minimumOrderValue)
  const maximumDiscountAmount = numberOrNull(input.maximumDiscountAmount)
  const totalUsageLimit = limitOrNull(input.totalUsageLimit)
  const perCustomerUsageLimit = limitOrNull(input.perCustomerUsageLimit)
  if (!name || name.length > 120 || (type !== "percentage" && type !== "fixed")
    || !Number.isFinite(value) || value <= 0 || (type === "percentage" && value > 100)
    || (target !== "category" && target !== "products") || !startsAt || !endsAt || startsAt >= endsAt
    || minimumOrderValue === undefined || maximumDiscountAmount === undefined
    || totalUsageLimit === undefined || perCustomerUsageLimit === undefined
    || typeof input.active !== "boolean") {
    return { error: "Enter a valid discount name, value, target, limits, and start/end dates." as const }
  }
  let categoryId: ObjectId | undefined
  let productIds: ObjectId[] | undefined
  if (target === "category") {
    if (typeof input.categoryId !== "string" || !ObjectId.isValid(input.categoryId)) {
      return { error: "Select a valid category for this discount." as const }
    }
    categoryId = new ObjectId(input.categoryId)
  } else {
    productIds = objectIds(input.productIds)
    if (!productIds?.length) return { error: "Select at least one valid product for this discount." as const }
  }
  return { data: {
    name,
    type,
    value,
    target,
    ...(categoryId ? { categoryId } : {}),
    ...(productIds ? { productIds } : {}),
    startsAt,
    endsAt,
    minimumOrderValue,
    maximumDiscountAmount,
    totalUsageLimit,
    perCustomerUsageLimit,
    active: input.active,
    ...(id ? {} : { usageCount: 0 }),
    updatedAt: new Date(),
  } }
}

async function parseCoupon(input: Record<string, unknown>, id: ObjectId | null) {
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : ""
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : ""
  const type = input.type
  const value = Number(input.value)
  const minimumOrderValue = numberOrNull(input.minimumOrderValue)
  const maximumDiscountAmount = numberOrNull(input.maximumDiscountAmount)
  const totalUsageLimit = limitOrNull(input.totalUsageLimit)
  const perCustomerUsageLimit = limitOrNull(input.perCustomerUsageLimit)
  const minimumEligibleQuantity = limitOrNull(input.minimumEligibleQuantity)
  const startsAt = validDate(input.startsAt)
  const endsAt = validDate(input.endsAt)
  const productIds = objectIds(input.productIds ?? [])
  const categoryIds = objectIds(input.categoryIds ?? [])
  const freeShipping = input.freeShipping === true
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code) || !name || name.length > 120
    || (type !== "percentage" && type !== "fixed")
    || !Number.isFinite(value) || value < 0 || (type === "percentage" && value > 100)
    || (value === 0 && !freeShipping)
    || minimumOrderValue === null || minimumOrderValue === undefined
    || maximumDiscountAmount === undefined || totalUsageLimit === undefined
    || perCustomerUsageLimit === undefined || minimumEligibleQuantity === undefined
    || !startsAt || !endsAt || startsAt >= endsAt || !productIds || !categoryIds
    || typeof input.firstOrderOnly !== "boolean" || typeof input.active !== "boolean") {
    return { error: "Enter a valid coupon code, value, restrictions, and start/end dates." as const }
  }
  return { data: {
    code,
    name,
    type,
    value,
    minimumOrderValue,
    maximumDiscountAmount,
    startsAt,
    endsAt,
    totalUsageLimit,
    perCustomerUsageLimit,
    productIds,
    categoryIds,
    minimumEligibleQuantity,
    firstOrderOnly: input.firstOrderOnly,
    freeShipping,
    active: input.active,
    ...(id ? {} : { usageCount: 0 }),
    updatedAt: new Date(),
  } }
}

function parseSettings(input: Record<string, unknown>, adminId: string) {
  if (!isRecord(input.shipping) || !isRecord(input.tax) || !Array.isArray(input.additionalCharges)
    || input.additionalCharges.length > 20) return { error: "Enter valid shipping, tax, and additional charge settings." as const }

  const shipping = input.shipping
  const fixedCharge = numberOrNull(shipping.fixedCharge)
  const freeShippingThreshold = numberOrNull(shipping.freeShippingThreshold)
  if (fixedCharge === undefined || freeShippingThreshold === undefined
    || typeof shipping.freeShippingEnabled !== "boolean" || typeof shipping.taxable !== "boolean"
    || !Array.isArray(shipping.valueRanges) || shipping.valueRanges.length > 20) {
    return { error: "Enter valid shipping charges and thresholds." as const }
  }
  const valueRanges: PricingSettingsDocument["shipping"]["valueRanges"] = []
  for (const rawRange of shipping.valueRanges) {
    if (!isRecord(rawRange)) return { error: "Enter valid order-value shipping ranges." as const }
    const minimum = numberOrNull(rawRange.minimum)
    const maximum = numberOrNull(rawRange.maximum)
    const charge = numberOrNull(rawRange.charge)
    if (minimum === null || minimum === undefined || maximum === undefined || charge === null || charge === undefined
      || (maximum !== null && maximum <= minimum)) {
      return { error: "Each shipping range needs valid minimum, maximum, and charge values." as const }
    }
    valueRanges.push({ minimum, maximum, charge })
  }
  valueRanges.sort((a, b) => a.minimum - b.minimum)
  if (valueRanges.some((range, index) => index > 0
    && (valueRanges[index - 1].maximum === null || range.minimum <= valueRanges[index - 1].maximum!))) {
    return { error: "Shipping value ranges cannot overlap." as const }
  }

  const rate = numberOrNull(input.tax.rate)
  if (rate === undefined || (rate !== null && rate > 100)
    || (input.tax.mode !== "inclusive" && input.tax.mode !== "exclusive")) {
    return { error: "Choose an inclusive or exclusive tax mode and a GST rate between 0 and 100%." as const }
  }
  const additionalCharges: PricingSettingsDocument["additionalCharges"] = []
  for (const rawCharge of input.additionalCharges) {
    if (!isRecord(rawCharge)) return { error: "Enter valid additional charges." as const }
    const name = typeof rawCharge.name === "string" ? rawCharge.name.trim().replace(/\s+/g, " ") : ""
    const value = numberOrNull(rawCharge.value)
    if (!name || name.length > 80 || value === null || value === undefined
      || (rawCharge.type !== "fixed" && rawCharge.type !== "percentage")
      || (rawCharge.type === "percentage" && value > 100)
      || typeof rawCharge.active !== "boolean" || typeof rawCharge.taxable !== "boolean") {
      return { error: "Enter a valid name, type, value, and tax setting for each charge." as const }
    }
    additionalCharges.push({
      id: typeof rawCharge.id === "string" && /^[\w-]{1,80}$/.test(rawCharge.id) ? rawCharge.id : randomUUID(),
      name,
      type: rawCharge.type,
      value,
      active: rawCharge.active,
      taxable: rawCharge.taxable,
    })
  }
  return { data: {
    _id: "store-pricing" as const,
    shipping: {
      configured: fixedCharge !== null,
      fixedCharge,
      freeShippingEnabled: shipping.freeShippingEnabled,
      freeShippingThreshold,
      valueRanges,
      taxable: shipping.taxable,
    },
    tax: {
      configured: rate !== null,
      mode: input.tax.mode,
      rate,
    },
    additionalCharges,
    updatedAt: new Date(),
    updatedBy: adminId,
  } }
}

export async function GET() {
  try {
    await requireAdmin()
    const database = await getDatabase()
    const [discounts, coupons, settings] = await Promise.all([
      database.collection<PricingDiscountDocument>("pricingDiscounts").find({}).sort({ updatedAt: -1 }).toArray(),
      database.collection<PricingCouponDocument>("pricingCoupons").find({}).sort({ updatedAt: -1 }).toArray(),
      database.collection<PricingSettingsDocument>("pricingSettings").findOne({ _id: "store-pricing" }),
    ])
    return NextResponse.json({
      discounts: discounts.map((item) => ({
        ...item,
        id: item._id.toString(),
        categoryId: item.categoryId?.toString() ?? null,
        productIds: item.productIds?.map((value) => value.toString()) ?? [],
      })),
      coupons: coupons.map((item) => ({
        ...item,
        id: item._id.toString(),
        productIds: item.productIds?.map((value) => value.toString()) ?? [],
        categoryIds: item.categoryIds?.map((value) => value.toString()) ?? [],
      })),
      settings: settings ?? emptyPricingSettings(),
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not load pricing administration data.", error)
    return NextResponse.json({ error: "Pricing settings are temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAdmin()
    const body: unknown = await request.json()
    if (!isRecord(body) || typeof body.type !== "string") {
      return NextResponse.json({ error: "Invalid pricing update." }, { status: 400 })
    }
    const database = await getDatabase()
    const now = new Date()
    if (body.type === "settings" && isRecord(body.data)) {
      const parsed = parseSettings(body.data, userId)
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
      await database.collection<PricingSettingsDocument>("pricingSettings")
        .replaceOne({ _id: "store-pricing" }, parsed.data, { upsert: true })
      return NextResponse.json({ success: true })
    }
    if ((body.type !== "discount" && body.type !== "coupon") || !isRecord(body.data)) {
      return NextResponse.json({ error: "Select valid pricing settings." }, { status: 400 })
    }
    const parsed = body.type === "discount"
      ? await parseDiscount(body.data, null)
      : await parseCoupon(body.data, null)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    if (body.type === "discount") {
      const data = parsed.data
      if (data.target === "category" && data.categoryId) {
        const found = await database.collection<CategoryDocument>("categories").findOne({ _id: data.categoryId })
        if (!found) return NextResponse.json({ error: "The selected category does not exist." }, { status: 400 })
      }
      if (data.target === "products" && data.productIds) {
        const found = await database.collection<ProductDocument>("products").countDocuments({ _id: { $in: data.productIds } })
        if (found !== data.productIds.length) return NextResponse.json({ error: "One or more selected products do not exist." }, { status: 400 })
      }
      await database.collection<PricingDiscountDocument>("pricingDiscounts").insertOne({
        ...data,
        _id: new ObjectId(),
        createdAt: now,
      })
    } else {
      const data = parsed.data
      const [products, categories] = await Promise.all([
        data.productIds?.length ? database.collection<ProductDocument>("products").countDocuments({ _id: { $in: data.productIds } }) : 0,
        data.categoryIds?.length ? database.collection<CategoryDocument>("categories").countDocuments({ _id: { $in: data.categoryIds } }) : 0,
      ])
      if (products !== data.productIds?.length || categories !== data.categoryIds?.length) {
        return NextResponse.json({ error: "One or more selected products or categories do not exist." }, { status: 400 })
      }
      await database.collection<PricingCouponDocument>("pricingCoupons").insertOne({
        ...data,
        _id: new ObjectId(),
        createdAt: now,
      })
    }
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "That coupon code is already in use." }, { status: 409 })
    }
    console.error("Could not save pricing data.", error)
    return NextResponse.json({ error: "The pricing change could not be saved." }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body: unknown = await request.json()
    if (!isRecord(body) || (body.type !== "discount" && body.type !== "coupon")
      || typeof body.id !== "string" || !ObjectId.isValid(body.id) || !isRecord(body.data)) {
      return NextResponse.json({ error: "Invalid pricing update." }, { status: 400 })
    }
    const database = await getDatabase()
    const id = new ObjectId(body.id)
    const parsed = body.type === "discount"
      ? await parseDiscount(body.data, id)
      : await parseCoupon(body.data, id)
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    if (body.type === "discount") {
      const current = await database.collection<PricingDiscountDocument>("pricingDiscounts").findOne({ _id: id })
      if (!current) return NextResponse.json({ error: "Discount not found." }, { status: 404 })
      await database.collection<PricingDiscountDocument>("pricingDiscounts").updateOne(
        { _id: id },
        { $set: { ...parsed.data, usageCount: current.usageCount, createdAt: current.createdAt } },
      )
    } else {
      const current = await database.collection<PricingCouponDocument>("pricingCoupons").findOne({ _id: id })
      if (!current) return NextResponse.json({ error: "Coupon not found." }, { status: 404 })
      await database.collection<PricingCouponDocument>("pricingCoupons").updateOne(
        { _id: id },
        { $set: { ...parsed.data, usageCount: current.usageCount, createdAt: current.createdAt } },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "That coupon code is already in use." }, { status: 409 })
    }
    console.error("Could not update pricing data.", error)
    return NextResponse.json({ error: "The pricing change could not be saved." }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const id = searchParams.get("id") ?? ""
    if ((type !== "discount" && type !== "coupon") || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Select a valid pricing rule." }, { status: 400 })
    }
    const database = await getDatabase()
    const objectId = new ObjectId(id)
    const collection = type === "discount"
      ? database.collection<PricingDiscountDocument>("pricingDiscounts")
      : database.collection<PricingCouponDocument>("pricingCoupons")
    const campaign = await collection.findOne({ _id: objectId }, { projection: { _id: 1 } })
    if (!campaign) return NextResponse.json({ error: "Pricing rule not found." }, { status: 404 })
    const redemptions = await database.collection<PricingRedemptionDocument>("pricingRedemptions")
      .countDocuments({ campaignId: objectId, campaignType: type, status: { $in: ["reserved", "redeemed"] } })
    if (redemptions) {
      return NextResponse.json({ error: "This rule has order history and cannot be deleted. Deactivate it instead." }, { status: 409 })
    }
    await collection.deleteOne({ _id: objectId })
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    console.error("Could not delete pricing rule.", error)
    return NextResponse.json({ error: "The pricing rule could not be deleted." }, { status: 503 })
  }
}
