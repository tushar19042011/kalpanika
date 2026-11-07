import "server-only"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"
import type { Product, ProductCategory } from "@/lib/products"

const shapeClasses = ["shape-1", "shape-2", "shape-3", "shape-4"]
const categoryBackgrounds = [
  "bg-[#e9ddc5]",
  "bg-[#ded6cc]",
  "bg-[#eee6c8]",
  "bg-[#e8d2bd]",
  "bg-[#e4d8c9]",
]

function stableIndex(value: string, length: number) {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % length
}

export function toCatalogProduct(
  product: ProductDocument,
  category: CategoryDocument,
): Product {
  return {
    slug: product.slug,
    name: product.name,
    category: category.name,
    categoryId: category._id.toString(),
      id: product._id.toString(),
    sku: product.sku,
    price: product.price,
    taxRate: product.taxRate ?? null,
    note: product.description,
    imageClass: shapeClasses[stableIndex(product.slug, shapeClasses.length)],
    imageUrl: product.images[0] ?? null,
    images: product.images,
    stock: product.stock,
    active: product.active,
    featured: product.featured,
    material: product.material,
    dimensions: product.dimensions,
    care: product.care,
  }
}

export function toProductCategory(
  category: CategoryDocument,
  productCount: number,
  sampleProductSlug?: string,
): ProductCategory {
  return {
    id: category._id.toString(),
    slug: category.slug,
    name: category.name,
    description: category.description,
    active: category.active,
    priority: category.priority,
    productCount,
    imageClass: sampleProductSlug
      ? shapeClasses[stableIndex(sampleProductSlug, shapeClasses.length)]
      : null,
    imageUrl: category.imageUrl,
    imageBackground: categoryBackgrounds[stableIndex(category.slug, categoryBackgrounds.length)],
  }
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
