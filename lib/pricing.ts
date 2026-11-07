import "server-only"
import type { ClientSession, Db } from "mongodb"
import { calculatePricing, type PricingCouponInput, type PricingDiscountInput, type PricingLineInput, type PricingQuote, type PricingSettingsInput } from "@/lib/pricing-calculation"
import type { Product } from "@/lib/products"
import type { CategoryDocument, PricingCouponDocument, PricingDiscountDocument, PricingRedemptionDocument, PricingSettingsDocument, ProductDocument } from "@/lib/store-models"

export class PricingError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 | 429 | 503) {
    super(message)
    this.name = "PricingError"
  }
}

export type PricingRequestLine = { slug: string; quantity: number }
export type BuiltPricingQuote = {
  quote: PricingQuote
  products: ProductDocument[]
  categories: Map<string, CategoryDocument>
  discountIds: string[]
  couponId: string | null
}

export function emptyPricingSettings(): PricingSettingsDocument {
  return {
    _id: "store-pricing",
    shipping: {
      configured: false,
      fixedCharge: null,
      freeShippingEnabled: false,
      freeShippingThreshold: null,
      valueRanges: [],
      taxable: false,
    },
    tax: { configured: false, mode: "exclusive", rate: null },
    additionalCharges: [],
    updatedAt: new Date(0),
    updatedBy: "",
  }
}

function assertPricingConfigured(settings: PricingSettingsDocument | null) {
  if (!settings?.shipping.configured || settings.shipping.fixedCharge == null) {
    throw new PricingError("Shipping must be configured by an administrator before checkout.", 409)
  }
  if (!settings.tax.configured || settings.tax.rate == null) {
    throw new PricingError("Tax treatment must be configured by an administrator before checkout.", 409)
  }
}

function toSettingsInput(settings: PricingSettingsDocument): PricingSettingsInput {
  return {
    shipping: settings.shipping,
    tax: settings.tax,
    additionalCharges: settings.additionalCharges,
  }
}

function toDiscountInput(discount: PricingDiscountDocument): PricingDiscountInput {
  return {
    id: discount._id.toString(),
    name: discount.name,
    type: discount.type,
    value: discount.value,
    target: discount.target,
    categoryId: discount.categoryId?.toString(),
    productIds: discount.productIds?.map((id) => id.toString()),
    minimumOrderValue: discount.minimumOrderValue,
    maximumDiscountAmount: discount.maximumDiscountAmount,
  }
}

function toCouponInput(coupon: PricingCouponDocument): PricingCouponInput {
  return {
    code: coupon.code,
    name: coupon.name,
    type: coupon.type,
    value: coupon.value,
    minimumOrderValue: coupon.minimumOrderValue,
    maximumDiscountAmount: coupon.maximumDiscountAmount,
    productIds: coupon.productIds?.map((id) => id.toString()),
    categoryIds: coupon.categoryIds?.map((id) => id.toString()),
    minimumEligibleQuantity: coupon.minimumEligibleQuantity,
    freeShipping: coupon.freeShipping,
  }
}

async function campaignHasCapacity(
  database: Db,
  campaign: PricingDiscountDocument | PricingCouponDocument,
  campaignType: PricingRedemptionDocument["campaignType"],
  clerkUserId: string,
  session?: ClientSession,
) {
  if (campaign.totalUsageLimit != null && campaign.usageCount >= campaign.totalUsageLimit) return false
  if (campaign.perCustomerUsageLimit == null) return true
  const query = database.collection<PricingRedemptionDocument>("pricingRedemptions")
    .countDocuments({
      campaignId: campaign._id,
      campaignType,
      clerkUserId,
      status: { $in: ["reserved", "redeemed"] },
    }, session ? { session } : undefined)
  return await query < campaign.perCustomerUsageLimit
}

export async function buildPricingQuote(
  database: Db,
  requestLines: PricingRequestLine[],
  clerkUserId: string,
  couponCode = "",
  session?: ClientSession,
): Promise<BuiltPricingQuote> {
  const settings = await database.collection<PricingSettingsDocument>("pricingSettings")
    .findOne({ _id: "store-pricing" }, session ? { session } : undefined)
  assertPricingConfigured(settings)

  const requested = new Map<string, number>()
  for (const line of requestLines) {
    const quantity = (requested.get(line.slug) ?? 0) + line.quantity
    if (quantity > 20) throw new PricingError("A product quantity cannot exceed 20.", 400)
    requested.set(line.slug, quantity)
  }
  if (!requested.size || requested.size > 20) throw new PricingError("Your bag is empty or contains too many products.", 400)

  const products = await database.collection<ProductDocument>("products")
    .find({ slug: { $in: [...requested.keys()] }, active: true, archived: { $ne: true } }, session ? { session } : undefined)
    .toArray()
  if (products.length !== requested.size) throw new PricingError("One or more products are no longer available.", 409)
  for (const product of products) {
    const quantity = requested.get(product.slug) ?? 0
    if (!Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) {
      throw new PricingError(`${product.name} does not have enough stock.`, 409)
    }
  }
  const categoryIds = [...new Map(products.map((product) => [product.categoryId.toString(), product.categoryId])).values()]
  const categoryDocuments = await database.collection<CategoryDocument>("categories")
    .find({ _id: { $in: categoryIds }, active: true }, session ? { session } : undefined)
    .toArray()
  const categories = new Map(categoryDocuments.map((category) => [category._id.toString(), category]))
  if (products.some((product) => !categories.has(product.categoryId.toString()))) {
    throw new PricingError("One or more products are no longer available.", 409)
  }

  const now = new Date()
  const discountDocuments = await database.collection<PricingDiscountDocument>("pricingDiscounts")
    .find({ active: true, startsAt: { $lte: now }, endsAt: { $gte: now } }, session ? { session } : undefined)
    .limit(500)
    .toArray()
  const discounts: PricingDiscountInput[] = []
  for (const discount of discountDocuments) {
    if (await campaignHasCapacity(database, discount, "discount", clerkUserId, session)) {
      discounts.push(toDiscountInput(discount))
    }
  }

  let couponDocument: PricingCouponDocument | null = null
  const normalizedCode = couponCode.trim().toUpperCase()
  if (normalizedCode) {
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(normalizedCode)) {
      throw new PricingError("Enter a valid coupon code.", 400)
    }
    couponDocument = await database.collection<PricingCouponDocument>("pricingCoupons")
      .findOne({ code: normalizedCode }, session ? { session } : undefined)
    if (!couponDocument || !couponDocument.active
      || couponDocument.startsAt > now || couponDocument.endsAt < now) {
      throw new PricingError("This coupon is invalid, inactive, or outside its valid dates.", 400)
    }
    if (!await campaignHasCapacity(database, couponDocument, "coupon", clerkUserId, session)) {
      throw new PricingError("This coupon has reached its usage limit.", 409)
    }
    if (couponDocument.firstOrderOnly) {
      const previousPaidOrder = await database.collection("orders").findOne(
        { clerkUserId, paymentStatus: "paid" },
        { projection: { _id: 1 }, ...(session ? { session } : {}) },
      )
      if (previousPaidOrder) throw new PricingError("This coupon is available on first orders only.", 409)
    }
  }

  const lines: PricingLineInput[] = products.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    categoryId: product.categoryId.toString(),
    price: product.price,
    quantity: requested.get(product.slug) ?? 0,
    taxRate: product.taxRate ?? null,
  }))
  const quote = calculatePricing({
    lines,
    discounts,
    coupon: couponDocument ? toCouponInput(couponDocument) : null,
    settings: toSettingsInput(settings!),
  })
  if (couponDocument && !quote.coupon) {
    throw new PricingError("This coupon does not apply to the products or quantity in your bag.", 409)
  }
  const discountIds = [...new Set(quote.lines.flatMap((line) => line.discount ? [line.discount.id] : []))]
  return {
    quote,
    products,
    categories,
    discountIds,
    couponId: quote.coupon ? couponDocument?._id.toString() ?? null : null,
  }
}

export async function getCatalogDiscounts(database: Db) {
  const now = new Date()
  const discounts = await database.collection<PricingDiscountDocument>("pricingDiscounts").find({
    active: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
    $or: [{ minimumOrderValue: { $lte: 0 } }, { minimumOrderValue: null }, { minimumOrderValue: { $exists: false } }],
  }).limit(500).toArray()
  return discounts.filter((discount) =>
    discount.perCustomerUsageLimit == null
    && (discount.totalUsageLimit == null || discount.usageCount < discount.totalUsageLimit),
  )
}

export async function applyCatalogDiscounts(
  database: Db,
  products: Product[],
  categories: Map<string, CategoryDocument>,
) {
  const discounts = (await getCatalogDiscounts(database)).map(toDiscountInput)
  const settings: PricingSettingsInput = {
    shipping: {
      configured: false,
      fixedCharge: 0,
      freeShippingEnabled: false,
      freeShippingThreshold: null,
      valueRanges: [],
      taxable: false,
    },
    tax: { configured: false, mode: "exclusive", rate: 0 },
    additionalCharges: [],
  }
  return products.map((product) => {
    if (!product.id || !product.categoryId || !categories.get(product.categoryId)?.active) return product
    const quote = calculatePricing({
      lines: [{
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        price: product.price,
        quantity: 1,
        taxRate: product.taxRate ?? null,
      }],
      discounts,
      coupon: null,
      settings,
    })
    const line = quote.lines[0]
    if (!line || !line.discount || line.unitPrice >= line.originalUnitPrice) return product
    return {
      ...product,
      price: line.unitPrice,
      originalPrice: line.originalUnitPrice,
      discountAmount: line.productDiscountAmount,
      discountPercent: line.originalUnitPrice > 0
        ? Math.round(line.productDiscountAmount / line.originalUnitPrice * 1000) / 10
        : 0,
      discountName: line.discount.name,
    }
  })
}
