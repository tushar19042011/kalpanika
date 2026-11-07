import { ObjectId } from "mongodb"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validateProduct(value: unknown) {
  if (!isRecord(value)) return { error: "Invalid product data." as const }
  const name = typeof value.name === "string" ? value.name.trim() : ""
  const description = typeof value.description === "string" ? value.description.trim() : ""
  const sku = typeof value.sku === "string" ? value.sku.trim().toUpperCase() : ""
  const categoryId = typeof value.categoryId === "string" ? value.categoryId : ""
  const price = value.price
  const taxRate = value.taxRate === undefined || value.taxRate === null || value.taxRate === ""
    ? null
    : Number(value.taxRate)
  const stock = value.stock
  const status = value.status
  const images = value.images === undefined ? [] : value.images
  if (!name || name.length > 120 || !description || description.length > 2000 || !sku || sku.length > 80) {
    return { error: "Name, description, and SKU are required and must be within their allowed lengths." as const }
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return { error: "Price must be a positive number." as const }
  }
  if (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) {
    return { error: "Product GST rate must be between 0 and 100%, or left blank to use the store rate." as const }
  }
  if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
    return { error: "Stock must be a non-negative whole number." as const }
  }
  if (status !== "Active" && status !== "Inactive") {
    return { error: "Select a valid product visibility status." as const }
  }
  if (!ObjectId.isValid(categoryId) || !Array.isArray(images) || images.length > 10
    || !images.every((image) => typeof image === "string" && /^https?:\/\//i.test(image) && image.length <= 2048)) {
    return { error: "Select a valid category and provide valid product image URLs." as const }
  }
  const optionalText = (key: string, maximum: number) => {
    const text = value[key] === undefined ? "" : value[key]
    return typeof text === "string" && text.length <= maximum ? text.trim() : null
  }
  const material = optionalText("material", 100)
  const dimensions = optionalText("dimensions", 100)
  const care = optionalText("care", 500)
  if (material === null || dimensions === null || care === null) {
    return { error: "Product material, dimensions, or care details are invalid." as const }
  }

  return {
    data: {
      name,
      description,
      sku,
      categoryId: new ObjectId(categoryId),
      price,
      taxRate,
      stock,
      images: images as string[],
      active: status === "Active",
      featured: value.featured === true,
      material,
      dimensions,
      care,
    },
  }
}
