export type PricingLineInput = {
  id: string
  name: string
  categoryId: string
  price: number
  quantity: number
  taxRate?: number | null
}

export type PricingDiscountInput = {
  id: string
  name: string
  type: "percentage" | "fixed"
  value: number
  target: "category" | "products"
  categoryId?: string
  productIds?: string[]
  minimumOrderValue?: number | null
  maximumDiscountAmount?: number | null
}

export type PricingCouponInput = {
  code: string
  name: string
  type: "percentage" | "fixed"
  value: number
  minimumOrderValue: number
  maximumDiscountAmount?: number | null
  productIds?: string[]
  categoryIds?: string[]
  minimumEligibleQuantity?: number | null
  freeShipping: boolean
}

export type PricingSettingsInput = {
  shipping: {
    configured: boolean
    fixedCharge: number | null
    freeShippingEnabled: boolean
    freeShippingThreshold: number | null
    valueRanges: { minimum: number; maximum: number | null; charge: number }[]
    taxable: boolean
  }
  tax: { configured: boolean; mode: "inclusive" | "exclusive"; rate: number | null }
  additionalCharges: { id: string; name: string; type: "percentage" | "fixed"; value: number; active: boolean; taxable: boolean }[]
}

export type PricingQuote = {
  lines: {
    productId: string
    name: string
    categoryId: string
    quantity: number
    originalUnitPrice: number
    unitPrice: number
    productDiscountAmount: number
    discount: { id: string; name: string } | null
    couponDiscountAmount: number
    taxRate?: number | null
    taxAmount: number
  }[]
  originalSubtotal: number
  subtotal: number
  productDiscountTotal: number
  coupon: { code: string; name: string; discount: number } | null
  shippingCharge: number
  shippingRule: string
  taxMode: "inclusive" | "exclusive"
  taxAmount: number
  taxes: { name: string; rate: number; amount: number }[]
  additionalCharges: { name: string; amount: number; taxable: boolean }[]
  total: number
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

function calculateDiscount(base: number, type: "percentage" | "fixed", value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return roundMoney(Math.min(base, type === "percentage" ? base * Math.min(value, 100) / 100 : value))
}

function calculateLineDiscount(base: number, quantity: number, type: "percentage" | "fixed", value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  const amount = type === "percentage"
    ? base * Math.min(value, 100) / 100
    : value * quantity
  return roundMoney(Math.min(base, amount))
}

function isDiscountApplicable(discount: PricingDiscountInput, line: PricingLineInput) {
  if (discount.target === "category") return discount.categoryId === line.categoryId
  return discount.productIds?.includes(line.id) === true
}

export function calculatePricing(input: {
  lines: PricingLineInput[]
  discounts: PricingDiscountInput[]
  coupon: PricingCouponInput | null
  settings: PricingSettingsInput
}): PricingQuote {
  const { lines, discounts, coupon, settings } = input
  const originalSubtotal = roundMoney(lines.reduce(
    (sum, line) => sum + nonNegative(line.price) * Math.max(0, line.quantity),
    0,
  ))

  const validDiscounts = discounts.filter((discount) =>
    Number.isFinite(discount.value)
    && discount.value > 0
    && (discount.minimumOrderValue == null || originalSubtotal >= discount.minimumOrderValue),
  )

  const allocations = new Map<string, Map<string, number>>()
  for (const discount of validDiscounts) {
    const matchingLines = lines.filter((line) => isDiscountApplicable(discount, line))
    const potential = matchingLines.map((line) => ({
      line,
      amount: calculateLineDiscount(
        nonNegative(line.price) * Math.max(0, line.quantity),
        Math.max(0, line.quantity),
        discount.type,
        discount.value,
      ),
    }))
    const potentialTotal = roundMoney(potential.reduce((sum, item) => sum + item.amount, 0))
    const allowedTotal = discount.maximumDiscountAmount == null
      ? potentialTotal
      : Math.min(potentialTotal, Math.max(0, discount.maximumDiscountAmount))
    let remaining = roundMoney(allowedTotal)
    const perLine = new Map<string, number>()
    for (const [index, item] of potential.entries()) {
      const allocated = index === potential.length - 1
        ? remaining
        : potentialTotal > 0 ? roundMoney(allowedTotal * item.amount / potentialTotal) : 0
      const amount = roundMoney(Math.min(item.amount, allocated, remaining))
      perLine.set(item.line.id, amount)
      remaining = roundMoney(Math.max(0, remaining - amount))
    }
    allocations.set(discount.id, perLine)
  }

  const discountedLines = lines.map((line) => {
    const base = roundMoney(nonNegative(line.price) * Math.max(0, line.quantity))
    const candidates = validDiscounts
      .filter((discount) => isDiscountApplicable(discount, line))
      .map((discount) => ({
        discount,
        amount: allocations.get(discount.id)?.get(line.id) ?? 0,
      }))
      .sort((left, right) => right.amount - left.amount)
    const winner = candidates[0]
    const productDiscountAmount = roundMoney(Math.min(base, winner?.amount ?? 0))
    return {
      productId: line.id,
      name: line.name,
      categoryId: line.categoryId,
      quantity: line.quantity,
      originalUnitPrice: roundMoney(nonNegative(line.price)),
      unitPrice: line.quantity > 0
        ? roundMoney(Math.max(0, nonNegative(line.price) - productDiscountAmount / line.quantity))
        : roundMoney(nonNegative(line.price)),
      productDiscountAmount,
      discount: productDiscountAmount > 0 && winner ? { id: winner.discount.id, name: winner.discount.name } : null,
      couponDiscountAmount: 0,
      taxRate: line.taxRate,
      taxAmount: 0,
    }
  })

  const productDiscountTotal = roundMoney(discountedLines.reduce((sum, line) => sum + line.productDiscountAmount, 0))
  const subtotal = roundMoney(Math.max(0, originalSubtotal - productDiscountTotal))
  let couponDiscount = 0
  let couponQualified = false
  if (
    coupon
    && subtotal >= Math.max(0, coupon.minimumOrderValue)
    && coupon.code
  ) {
    const eligible = discountedLines.filter((line) =>
      (!coupon.productIds?.length || coupon.productIds.includes(line.productId))
      && (!coupon.categoryIds?.length || coupon.categoryIds.includes(line.categoryId)),
    )
    const eligibleAmount = roundMoney(eligible.reduce(
      (sum, line) => sum + Math.max(0, line.originalUnitPrice * line.quantity - line.productDiscountAmount),
      0,
    ))
    const eligibleQuantity = eligible.reduce((sum, line) => sum + line.quantity, 0)
    if (eligibleAmount > 0 && eligibleQuantity >= (coupon.minimumEligibleQuantity ?? 0)) {
      couponQualified = true
      couponDiscount = calculateDiscount(eligibleAmount, coupon.type, coupon.value)
      if (coupon.maximumDiscountAmount != null) {
        couponDiscount = roundMoney(Math.min(couponDiscount, Math.max(0, coupon.maximumDiscountAmount)))
      }
      couponDiscount = Math.min(couponDiscount, eligibleAmount)
      let remaining = couponDiscount
      for (const [index, line] of eligible.entries()) {
        const lineAmount = Math.max(0, line.originalUnitPrice * line.quantity - line.productDiscountAmount)
        const allocation = index === eligible.length - 1
          ? remaining
          : roundMoney(couponDiscount * lineAmount / eligibleAmount)
        line.couponDiscountAmount = roundMoney(Math.min(lineAmount, allocation, remaining))
        remaining = roundMoney(Math.max(0, remaining - line.couponDiscountAmount))
      }
    }
  }

  const couponTotal = roundMoney(couponDiscount)
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - couponTotal))
  const ranges = [...settings.shipping.valueRanges].sort((a, b) => a.minimum - b.minimum)
  let shippingCharge = settings.shipping.fixedCharge == null ? 0 : nonNegative(settings.shipping.fixedCharge)
  let shippingRule = "Fixed shipping"
  if (ranges.length) {
    const range = ranges.find((item) =>
      discountedSubtotal >= item.minimum && (item.maximum == null || discountedSubtotal <= item.maximum),
    )
    if (range) {
      shippingCharge = nonNegative(range.charge)
      shippingRule = "Order-value shipping"
    }
  }
  if (coupon?.freeShipping) {
    shippingCharge = 0
    shippingRule = `Free shipping coupon ${coupon.code}`
  } else if (
    settings.shipping.freeShippingEnabled
    && settings.shipping.freeShippingThreshold != null
    && discountedSubtotal >= settings.shipping.freeShippingThreshold
  ) {
    shippingCharge = 0
    shippingRule = "Free-shipping threshold"
  }
  shippingCharge = roundMoney(shippingCharge)

  const additionalCharges = settings.additionalCharges.filter((charge) => charge.active).map((charge) => ({
    name: charge.name,
    taxable: charge.taxable,
    amount: roundMoney(charge.type === "percentage"
      ? discountedSubtotal * Math.max(0, charge.value) / 100
      : Math.max(0, charge.value)),
  }))
  const additionalTotal = roundMoney(additionalCharges.reduce((sum, charge) => sum + charge.amount, 0))

  const taxableBases = new Map<number, number>()
  for (const line of discountedLines) {
    const lineBase = Math.max(
      0,
      line.originalUnitPrice * line.quantity - line.productDiscountAmount - line.couponDiscountAmount,
    )
    const rate = Math.max(0, line.taxRate ?? settings.tax.rate ?? 0)
    taxableBases.set(rate, roundMoney((taxableBases.get(rate) ?? 0) + lineBase))
  }
  if (settings.shipping.taxable && shippingCharge > 0) {
    const rate = Math.max(0, settings.tax.rate ?? 0)
    taxableBases.set(rate, roundMoney((taxableBases.get(rate) ?? 0) + shippingCharge))
  }
  for (const charge of additionalCharges) {
    if (!charge.taxable || charge.amount <= 0) continue
    const rate = Math.max(0, settings.tax.rate ?? 0)
    taxableBases.set(rate, roundMoney((taxableBases.get(rate) ?? 0) + charge.amount))
  }
  const taxes = new Map<number, number>()
  for (const [rate, base] of taxableBases) {
    const amount = settings.tax.mode === "inclusive"
      ? base - base / (1 + rate / 100)
      : base * rate / 100
    taxes.set(rate, roundMoney(Math.max(0, amount)))
  }
  for (const line of discountedLines) {
    const rate = Math.max(0, line.taxRate ?? settings.tax.rate ?? 0)
    const base = Math.max(0, line.originalUnitPrice * line.quantity - line.productDiscountAmount - line.couponDiscountAmount)
    line.taxAmount = roundMoney(settings.tax.mode === "inclusive"
      ? base - base / (1 + rate / 100)
      : base * rate / 100)
  }
  const taxAmount = roundMoney([...taxes.values()].reduce((sum, amount) => sum + amount, 0))
  const taxEntries = [...taxes.entries()].map(([rate, amount]) => ({
    name: `GST (${rate}%)`,
    rate,
    amount,
  }))
  const total = roundMoney(Math.max(
    0,
    discountedSubtotal + shippingCharge + additionalTotal
      + (settings.tax.mode === "exclusive" ? taxAmount : 0),
  ))

  return {
    lines: discountedLines,
    originalSubtotal,
    subtotal,
    productDiscountTotal,
    coupon: couponQualified && coupon ? { code: coupon.code, name: coupon.name, discount: couponTotal } : null,
    shippingCharge,
    shippingRule,
    taxMode: settings.tax.mode,
    taxAmount,
    taxes: taxEntries,
    additionalCharges,
    total,
  }
}
