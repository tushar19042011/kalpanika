"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type {
  AdminFulfillmentStatus,
  AdminOrder,
  AdminProduct,
  AdminProductStatus,
} from "@/lib/admin-data"

type ProductInput = Omit<AdminProduct, "id" | "updated">
type AdminDataContextValue = {
  products: AdminProduct[]
  orders: AdminOrder[]
  ready: boolean
  storageError: string | null
  notice: string | null
  setNotice: (message: string | null) => void
  addProduct: (product: ProductInput) => Promise<string | null>
  updateProduct: (id: string, product: ProductInput) => Promise<string | null>
  deleteProduct: (id: string) => Promise<string | null>
  setProductStatus: (id: string, status: AdminProductStatus) => Promise<string | null>
  setProductStock: (id: string, stock: number) => Promise<string | null>
  updateOrder: (id: string, order: Omit<AdminOrder, "id">) => Promise<string | null>
  deleteOrder: (id: string) => Promise<string | null>
  setPaymentStatus: (id: string, status: AdminOrder["payment"]) => Promise<string | null>
  setFulfillmentStatus: (id: string, status: AdminFulfillmentStatus) => Promise<string | null>
  setOrderArchived: (id: string, archived: boolean) => Promise<string | null>
  refresh: () => Promise<void>
}

type AdminDataResponse = {
  products?: AdminProduct[]
  orders?: AdminOrder[]
  error?: string
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null)

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/data", { cache: "no-store" })
      const data = await response.json() as AdminDataResponse
      if (!response.ok) throw new Error(data.error ?? "Admin data is temporarily unavailable.")
      setProducts(Array.isArray(data.products) ? data.products : [])
      setOrders(Array.isArray(data.orders) ? data.orders : [])
      setStorageError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin data is temporarily unavailable."
      setStorageError(message)
      console.error("Unable to load admin data.", error)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback(async (
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => {
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) return data.error ?? "The requested change could not be saved."
      await refresh()
      return null
    } catch (error) {
      console.error("Unable to save admin data.", error)
      return "The server could not be reached. Please try again."
    }
  }, [refresh])

  const addProduct = useCallback((product: ProductInput) => (
    mutate("/api/admin/products", "POST", product)
  ), [mutate])

  const updateProduct = useCallback((id: string, product: ProductInput) => (
    mutate(`/api/admin/products/${encodeURIComponent(id)}`, "PATCH", product)
  ), [mutate])

  const deleteProduct = useCallback((id: string) => (
    mutate(`/api/admin/products/${encodeURIComponent(id)}`, "DELETE")
  ), [mutate])

  const setProductStatus = useCallback((id: string, status: AdminProductStatus) => {
    const product = products.find((item) => item.id === id)
    if (!product) return Promise.resolve("This product could not be found.")
    const { id: _id, updated: _updated, ...values } = product
    return updateProduct(id, { ...values, status })
  }, [products, updateProduct])

  const setProductStock = useCallback((id: string, stock: number) => {
    if (!Number.isInteger(stock) || stock < 0) return Promise.resolve("Stock must be a non-negative whole number.")
    const product = products.find((item) => item.id === id)
    if (!product) return Promise.resolve("This product could not be found.")
    const { id: _id, updated: _updated, ...values } = product
    return updateProduct(id, { ...values, stock })
  }, [products, updateProduct])

  const setFulfillmentStatus = useCallback((id: string, status: AdminFulfillmentStatus) => (
    mutate(`/api/admin/orders/${encodeURIComponent(id)}`, "PATCH", { status })
  ), [mutate])

  const setOrderArchived = useCallback((id: string, archived: boolean) => (
    mutate(`/api/admin/orders/${encodeURIComponent(id)}`, "PATCH", { archived })
  ), [mutate])

  const updateOrder = useCallback((id: string, order: Omit<AdminOrder, "id">) => (
    setFulfillmentStatus(id, order.status)
  ), [setFulfillmentStatus])

  const setPaymentStatus = useCallback(async () => (
    "Payment status can only be updated by the verified payment provider."
  ), [])

  const deleteOrder = useCallback(async () => (
    "Order history cannot be deleted."
  ), [])

  const value = useMemo<AdminDataContextValue>(() => ({
    products,
    orders,
    ready,
    storageError,
    notice,
    setNotice,
    addProduct,
    updateProduct,
    deleteProduct,
    setProductStatus,
    setProductStock,
    updateOrder,
    deleteOrder,
    setPaymentStatus,
    setFulfillmentStatus,
    setOrderArchived,
    refresh,
  }), [
    products, orders, ready, storageError, notice, addProduct, updateProduct, deleteProduct,
    setProductStatus, setProductStock, updateOrder, deleteOrder, setPaymentStatus,
    setFulfillmentStatus, setOrderArchived, refresh,
  ])

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

export function useAdminData() {
  const value = useContext(AdminDataContext)
  if (!value) throw new Error("useAdminData must be used within AdminDataProvider.")
  return value
}
