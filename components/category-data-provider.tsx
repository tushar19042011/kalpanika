"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Product, ProductCategory } from "@/lib/products"

type NewCategory = Pick<ProductCategory, "name" | "description" | "imageUrl">
type CategoryDataContextValue = {
  categories: ProductCategory[]
  products: Product[]
  ready: boolean
  error: string | null
  addCategory: (input: NewCategory) => Promise<{ category?: ProductCategory; error?: string }>
  refreshCategories: () => Promise<void>
}

const CategoryDataContext = createContext<CategoryDataContextValue | null>(null)

type CatalogResponse = {
  categories?: ProductCategory[]
  products?: Product[]
  error?: string
}

export function CategoryDataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog?limit=1000", { cache: "no-store" })
      const data = await response.json() as CatalogResponse
      if (!response.ok) throw new Error(data.error ?? "Categories are temporarily unavailable.")
      setCategories(Array.isArray(data.categories) ? data.categories : [])
      setProducts(Array.isArray(data.products) ? data.products : [])
      setError(null)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Categories are temporarily unavailable."
      setError(message)
      console.error("Unable to load categories.", fetchError)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refreshCategories()
  }, [refreshCategories])

  const addCategory = useCallback(async (input: NewCategory) => {
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await response.json() as { category?: ProductCategory; error?: string }
      if (!response.ok || !data.category) {
        return { error: data.error ?? "The category could not be created." }
      }
      setCategories((current) => [...current, data.category!])
      return { category: data.category }
    } catch (error) {
      console.error("Unable to create category.", error)
      return { error: "The server could not be reached. Please try again." }
    }
  }, [])

  const value = useMemo(
    () => ({ categories, products, ready, error, addCategory, refreshCategories }),
    [categories, products, ready, error, addCategory, refreshCategories],
  )

  return <CategoryDataContext.Provider value={value}>{children}</CategoryDataContext.Provider>
}

export function useCategoryData() {
  const value = useContext(CategoryDataContext)
  if (!value) throw new Error("useCategoryData must be used within CategoryDataProvider.")
  return value
}
