import type { ObjectId } from "mongodb"

export type AdminAuditEntry = {
  action: string
  field: string
  from: string | number | boolean | null
  to: string | number | boolean | null
  updatedAt: Date
  updatedBy: string
}

export type CategoryDocument = {
  _id: ObjectId
  seedKey?: string
  name: string
  slug: string
  description: string
  imageUrl: string | null
  active: boolean
  priority: number
  createdAt: Date
  updatedAt: Date
}

export type ProductDocument = {
  _id: ObjectId
  seedKey?: string
  name: string
  slug: string
  description: string
  categoryId: ObjectId
  sku: string
  price: number
  taxRate?: number | null
  stock: number
  images: string[]
  active: boolean
  featured: boolean
  material: string
  dimensions: string
  care: string
  archived?: boolean
  announcementEligibleAt?: Date
  announcementQueuedAt?: Date
  announcementQueueStatus?: "pending" | "queued" | "suppressed"
  adminHistory?: AdminAuditEntry[]
  createdAt: Date
  updatedAt: Date
}

export type CartItem = {
  productId: ObjectId
  quantity: number
  addedAt: Date
}

export type CartDocument = {
  _id: ObjectId
  clerkUserId: string
  items: CartItem[]
  createdAt: Date
  updatedAt: Date
}

export type WishlistItem = {
  productId: ObjectId
  addedAt: Date
}

export type WishlistDocument = {
  _id: ObjectId
  clerkUserId: string
  items: WishlistItem[]
  createdAt: Date
  updatedAt: Date
}

export type CartMergeDocument = {
  _id: ObjectId
  clerkUserId: string
  mergeId: string
  createdAt: Date
}

export type OrderProductSnapshot = {
  productId: ObjectId
  slug: string
  name: string
  category: string
  sku: string
  price: number
  originalPrice?: number
  productDiscountAmount?: number
  appliedDiscount?: { id: string; name: string } | null
  quantity: number
  image: string | null
}

export type PricingDiscountDocument = {
  _id: ObjectId
  name: string
  type: "percentage" | "fixed"
  value: number
  target: "category" | "products"
  categoryId?: ObjectId
  productIds?: ObjectId[]
  startsAt: Date
  endsAt: Date
  minimumOrderValue?: number | null
  maximumDiscountAmount?: number | null
  totalUsageLimit?: number | null
  perCustomerUsageLimit?: number | null
  usageCount: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type PricingCouponDocument = {
  _id: ObjectId
  code: string
  name: string
  type: "percentage" | "fixed"
  value: number
  minimumOrderValue: number
  maximumDiscountAmount?: number | null
  startsAt: Date
  endsAt: Date
  totalUsageLimit?: number | null
  perCustomerUsageLimit?: number | null
  productIds?: ObjectId[]
  categoryIds?: ObjectId[]
  minimumEligibleQuantity?: number | null
  firstOrderOnly: boolean
  freeShipping: boolean
  active: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export type PricingSettingsDocument = {
  _id: "store-pricing"
  shipping: {
    configured: boolean
    fixedCharge: number | null
    freeShippingEnabled: boolean
    freeShippingThreshold: number | null
    valueRanges: { minimum: number; maximum: number | null; charge: number }[]
    taxable: boolean
  }
  tax: {
    configured: boolean
    mode: "inclusive" | "exclusive"
    rate: number | null
  }
  additionalCharges: {
    id: string
    name: string
    type: "percentage" | "fixed"
    value: number
    active: boolean
    taxable: boolean
  }[]
  updatedAt: Date
  updatedBy: string
}

export type PricingRedemptionDocument = {
  _id: ObjectId
  campaignId: ObjectId
  campaignType: "discount" | "coupon"
  clerkUserId: string
  orderId: string
  status: "reserved" | "redeemed" | "released"
  createdAt: Date
  updatedAt: Date
}

export type OrderPricingBreakdown = {
  originalSubtotal: number
  productDiscountTotal: number
  coupon: { code: string; name: string; discount: number } | null
  shippingCharge: number
  shippingRule: string
  taxMode: "inclusive" | "exclusive"
  taxAmount: number
  taxes: { name: string; rate: number; amount: number }[]
  additionalCharges: { name: string; amount: number }[]
  total: number
}

export type OrderDocument = {
  _id: ObjectId
  seedKey?: string
  orderId: string
  idempotencyKey: string
  clerkUserId: string
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  shipping: {
    address: string
    landmark: string
    city: string
    state: string
    pin: string
    country: string
  }
  items: OrderProductSnapshot[]
  subtotal: number
  shippingCharge: number
  discount: number
  pricingBreakdown?: OrderPricingBreakdown
  total: number
  paymentMethod: string
  paymentStatus: "pending" | "paid" | "failed" | "refunded"
  status: "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
  archived?: boolean
  statusHistory?: { status: string; updatedAt: Date; updatedBy: string }[]
  adminHistory?: AdminAuditEntry[]
  createdAt: Date
  updatedAt: Date
}

export type SupportRequestStatus = "new" | "in_progress" | "resolved"

export type SupportRequestDocument = {
  _id: ObjectId
  name: string
  email: string
  orderNumber: string
  message: string
  status: SupportRequestStatus
  createdAt: Date
  updatedAt: Date
  statusHistory: { status: SupportRequestStatus; updatedAt: Date; updatedBy: string }[]
}

export type NewsletterSubscriptionDocument = {
  _id: ObjectId
  email: string
  normalizedEmail: string
  unsubscribeTokenHash?: string
  unsubscribeVersion?: string
  verificationTokenHash?: string
  verificationTokenExpiresAt?: Date
  verifiedAt?: Date
  status: "pending" | "subscribed" | "unsubscribed"
  createdAt: Date
  updatedAt: Date
  subscribedAt?: Date
  unsubscribedAt?: Date
}

export type NewsletterAnnouncementStatus = "pending" | "processing" | "completed" | "failed"

export type NewsletterAnnouncementDocument = {
  _id: ObjectId
  productId: ObjectId
  product: {
    name: string
    slug: string
    description: string
    price: number
    image: string | null
  }
  status: NewsletterAnnouncementStatus
  recipientCursor?: ObjectId
  recipientSnapshotComplete: boolean
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  leaseUntil?: Date
  error?: string
}

export type NewsletterDeliveryStatus = "pending" | "processing" | "sent" | "failed" | "skipped"

export type NewsletterDeliveryDocument = {
  _id: ObjectId
  announcementId: ObjectId
  subscriberId: ObjectId
  email: string
  status: NewsletterDeliveryStatus
  attempts: number
  nextAttemptAt: Date
  leaseUntil?: Date
  lastError?: string
  providerEmailId?: string
  sentAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type PublicSubmissionRateLimitDocument = {
  _id: ObjectId
  scope: "contact" | "newsletter" | "coupon"
  requesterHash: string
  createdAt: Date
  expiresAt: Date
}
