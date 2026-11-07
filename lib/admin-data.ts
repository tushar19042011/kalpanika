export type AdminProductStatus = "Active" | "Inactive"
export type AdminPaymentStatus = "Paid" | "Pending" | "Failed" | "Refunded"
export type AdminFulfillmentStatus = "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled"

export const fulfillmentTransitions: Record<AdminFulfillmentStatus, AdminFulfillmentStatus[]> = {
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
}

export type AdminProduct = {
  id: string
  name: string
  description: string
  sku: string
  category: string
  categoryId?: string
  images?: string[]
  featured?: boolean
  price: number
  taxRate?: number | null
  stock: number
  status: AdminProductStatus
  updated: string
}

export type AdminOrder = {
  id: string
  customer: string
  email?: string
  date: string
  createdAt?: string
  items: number
  itemSnapshots?: { name: string; category?: string; sku: string; quantity: number; price: number; image: string | null }[]
  total: number
  subtotal?: number
  shippingCharge?: number
  payment: AdminPaymentStatus
  status: AdminFulfillmentStatus
  archived?: boolean
}

export const productStatuses: AdminProductStatus[] = ["Active", "Inactive"]
export const paymentStatuses: AdminPaymentStatus[] = ["Pending", "Paid", "Failed", "Refunded"]
export const fulfillmentStatuses: AdminFulfillmentStatus[] = ["Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"]

export const money = (value: number) => `₹${value.toLocaleString("en-IN")}`
