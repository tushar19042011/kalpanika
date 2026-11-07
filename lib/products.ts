export type Product = {
  id?: string
  slug: string
  name: string
  category: string
  categoryId?: string
  sku?: string
  price: number
  originalPrice?: number
  discountAmount?: number
  discountPercent?: number
  discountName?: string
  taxRate?: number | null
  note: string
  badge?: string
  imageClass: string
  imageUrl?: string | null
  images?: string[]
  stock?: number
  active?: boolean
  featured?: boolean
  material: string
  dimensions: string
  care: string
}

export type ProductCategory = {
  id?: string
  slug: string
  name: string
  description: string
  active: boolean
  priority: number
  productCount: number
  imageClass: string | null
  imageUrl: string | null
  imageBackground: string
}

export const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`
