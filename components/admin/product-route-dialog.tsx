"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/admin/admin-primitives"
import { useAdminData } from "@/components/admin/admin-data-provider"
import { ProductDialog, type ProductFormValues } from "@/components/admin/product-dialog"
import type { AdminProduct } from "@/lib/admin-data"

export function ProductRouteDialog({ productId }: { productId?: string }) {
  const router = useRouter()
  const { products, ready, addProduct, updateProduct, setNotice } = useAdminData()
  const [remoteProduct, setRemoteProduct] = useState<AdminProduct | null>(null)
  const [productError, setProductError] = useState("")
  const product = productId
    ? products.find((item) => item.id === productId) ?? (remoteProduct?.id === productId ? remoteProduct : undefined)
    : undefined

  useEffect(() => {
    if (!productId || !ready || products.some((item) => item.id === productId)) return
    const controller = new AbortController()
    void fetch(`/api/admin/products/${encodeURIComponent(productId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { product?: AdminProduct; error?: string }
        if (!response.ok || !data.product) throw new Error(data.error ?? "This product could not be found.")
        if (!controller.signal.aborted) setRemoteProduct(data.product)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setProductError(error instanceof Error ? error.message : "Product details are unavailable.")
      })
    return () => controller.abort()
  }, [productId, ready, products])
  const close = () => router.push("/admin/products")
  const save = async (values: ProductFormValues) => {
    const error = await (productId ? updateProduct(productId, values) : addProduct(values))
    if (!error) setNotice(productId ? "Product updated." : "Product added.")
    return error
  }

  return <div className="mx-auto max-w-4xl">
    <PageHeader
      title={productId ? "Edit product" : "Add product"}
      description={productId ? "Update product details and keep your catalog current." : "Create a new product for your Kalpanika catalog."}
    />
    {!ready ? <p className="text-sm text-[#777]">Loading product data…</p> : productId && !product && !productError
      ? <p role="status" className="text-sm text-[#777]">Loading product details…</p> : productId && !product
      ? <div className="rounded-xl border border-[#e8e6e0] bg-white p-5">
        <p role="alert" className="text-sm text-[#a34d4d]">{productError || "This product could not be found."}</p>
        <Link href="/admin/products" className="mt-4 inline-flex rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Back to products</Link>
      </div>
      : <ProductDialog key={product?.id ?? "new-product"} product={product} mode={productId ? "edit" : "create"} onClose={close} onSave={save} />}
  </div>
}
