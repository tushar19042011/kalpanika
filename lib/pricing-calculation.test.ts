import assert from "node:assert/strict"
import test from "node:test"
import { calculatePricing, type PricingSettingsInput } from "./pricing-calculation.ts"

const settings = (overrides: Partial<PricingSettingsInput> = {}): PricingSettingsInput => ({
  shipping: {
    configured: true,
    fixedCharge: 50,
    freeShippingEnabled: false,
    freeShippingThreshold: null,
    valueRanges: [],
    taxable: false,
  },
  tax: { configured: true, mode: "exclusive", rate: 0 },
  additionalCharges: [],
  ...overrides,
})

test("chooses the best automatic discount per line without stacking and honors its cap", () => {
  const quote = calculatePricing({
    lines: [
      { id: "p1", name: "One", categoryId: "c1", price: 100, quantity: 1 },
      { id: "p2", name: "Two", categoryId: "c1", price: 100, quantity: 1 },
    ],
    discounts: [
      { id: "category", name: "Category", target: "category", categoryId: "c1", type: "percentage", value: 20 },
      { id: "product", name: "Product", target: "products", productIds: ["p1"], type: "percentage", value: 50 },
      { id: "capped", name: "Capped", target: "products", productIds: ["p1", "p2"], type: "percentage", value: 40, maximumDiscountAmount: 30 },
    ],
    coupon: null,
    settings: settings(),
  })

  assert.equal(quote.productDiscountTotal, 70)
  assert.deepEqual(quote.lines.map((line) => line.productDiscountAmount), [50, 20])
  assert.equal(quote.total, 180)
})

test("applies coupons only to eligible discounted products, then shipping and tax", () => {
  const quote = calculatePricing({
    lines: [
      { id: "p1", name: "Eligible", categoryId: "c1", price: 1000, quantity: 1 },
      { id: "p2", name: "Excluded", categoryId: "c2", price: 500, quantity: 1 },
    ],
    discounts: [
      { id: "sale", name: "Sale", target: "products", productIds: ["p1"], type: "percentage", value: 10 },
    ],
    coupon: {
      code: "SAVE",
      name: "Save",
      type: "percentage",
      value: 10,
      minimumOrderValue: 0,
      productIds: ["p1"],
      freeShipping: false,
    },
    settings: settings({
      shipping: {
        configured: true,
        fixedCharge: 50,
        freeShippingEnabled: true,
        freeShippingThreshold: 1300,
        valueRanges: [],
        taxable: false,
      },
      tax: { configured: true, mode: "exclusive", rate: 5 },
      additionalCharges: [{ id: "packing", name: "Packing", type: "fixed", value: 10, active: true, taxable: false }],
    }),
  })

  assert.equal(quote.originalSubtotal, 1500)
  assert.equal(quote.productDiscountTotal, 100)
  assert.equal(quote.coupon?.discount, 90)
  assert.equal(quote.shippingCharge, 0)
  assert.equal(quote.taxAmount, 65.5)
  assert.equal(quote.total, 1385.5)
  assert.equal(quote.lines[1].couponDiscountAmount, 0)
})

test("extracts inclusive tax and clamps fixed coupons at the remaining amount", () => {
  const quote = calculatePricing({
    lines: [{ id: "p1", name: "One", categoryId: "c1", price: 100, quantity: 1 }],
    discounts: [],
    coupon: { code: "FREE", name: "Free", type: "fixed", value: 300, minimumOrderValue: 0, freeShipping: true },
    settings: settings({
      shipping: {
        configured: true,
        fixedCharge: 80,
        freeShippingEnabled: false,
        freeShippingThreshold: null,
        valueRanges: [],
        taxable: false,
      },
      tax: { configured: true, mode: "inclusive", rate: 10 },
      additionalCharges: [],
    }),
  })

  assert.equal(quote.coupon?.discount, 100)
  assert.equal(quote.shippingCharge, 0)
  assert.equal(quote.total, 0)
  assert.equal(quote.taxAmount, 0)
  assert.equal(quote.total >= 0, true)
})

