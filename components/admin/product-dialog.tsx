"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Check, ChevronDown, ImagePlus, Plus, X } from "lucide-react"
import { Select } from "@base-ui/react/select"
import { useCategoryData } from "@/components/category-data-provider"
import { AdminDialog } from "@/components/admin/admin-interactions"
import { Button } from "@/components/ui/button"
import { productStatuses, type AdminProduct, type AdminProductStatus } from "@/lib/admin-data"
import type { ProductCategory } from "@/lib/products"

export type ProductFormValues = Omit<AdminProduct, "id" | "updated">
type ProductDialogMode = "create" | "edit" | "view"
const MAX_CATEGORY_IMAGE_SIZE = 1024 * 1024
const ADD_CATEGORY_OPTION = "__add_new_category__"

export function ProductDialog({
  product,
  mode,
  onClose,
  onSave,
}: {
  product?: AdminProduct
  mode: ProductDialogMode
  onClose: () => void
  onSave: (values: ProductFormValues) => Promise<string | null> | string | null
}) {
  const { categories, ready, addCategory } = useCategoryData()
  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const initialCategory = activeCategories[0]
  const productCategoryReference = product?.categoryId
    ?? (product?.category && /^[a-f\d]{24}$/i.test(product.category) ? product.category : undefined)
  const productCategory = activeCategories.find((category) => category.id === productCategoryReference)
    ?? activeCategories.find((category) => category.name === product?.category)
  const productCategoryId = productCategory?.id
    ?? productCategoryReference
    ?? categories.find((category) => category.name === product?.category)?.id
    ?? (product ? "" : initialCategory?.id ?? "")
  const productCategoryName = productCategory?.name
    ?? (product?.category && !/^[a-f\d]{24}$/i.test(product.category) ? product.category : "Unavailable category")
  const [values, setValues] = useState<ProductFormValues>(() => product
    ? { name: product.name, description: product.description, sku: product.sku, category: productCategoryName, categoryId: productCategoryId, images: product.images ?? [], featured: product.featured ?? false, price: product.price, taxRate: product.taxRate ?? null, stock: product.stock, status: product.status }
    : { name: "", description: "", sku: "", category: initialCategory?.name ?? "", categoryId: initialCategory?.id ?? "", images: [], featured: false, price: 0, taxRate: null, stock: 0, status: "Active" })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const readOnly = mode === "view"
  const title = mode === "create" ? "Add product" : mode === "edit" ? "Edit product" : "Product details"

  useEffect(() => {
    if (!product) {
      if (!values.categoryId && initialCategory?.id) {
        setValues((current) => ({ ...current, category: initialCategory.name, categoryId: initialCategory.id }))
      }
      return
    }
    setValues({
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: productCategoryName,
      categoryId: productCategoryId,
      images: product.images ?? [],
      featured: product.featured ?? false,
      price: product.price,
      taxRate: product.taxRate ?? null,
      stock: product.stock,
      status: product.status,
    })
    setError(null)
  }, [product, productCategoryId, productCategoryName, initialCategory])

  const change = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!values.name.trim() || !values.description.trim() || !values.sku.trim()) {
      setError("Name, description, and SKU are required.")
      return
    }
    if (!Number.isFinite(values.price) || values.price <= 0) {
      setError("Price must be greater than zero.")
      return
    }
    if (!Number.isInteger(values.stock) || values.stock < 0) {
      setError("Stock must be a non-negative whole number.")
      return
    }
    setSubmitting(true)
    const category = activeCategories.find((item) => item.id === values.categoryId)
    if (!category?.id) {
      setSubmitting(false)
      setError("Select an active category before saving.")
      return
    }
    const result = await onSave({
      ...values,
      category: category?.name ?? values.category,
      categoryId: category.id,
      sku: values.sku.trim(),
      name: values.name.trim(),
      description: values.description.trim(),
    })
    setSubmitting(false)
    if (result) {
      setError(result)
      return
    }
    onClose()
  }

  const createCategory = async (input: Pick<ProductCategory, "name" | "description" | "imageUrl">) => {
    const result = await addCategory(input)
    if (result.error || !result.category) return result.error ?? "The category could not be created."
    const category = result.category
    setValues((current) => ({ ...current, category: category.name, categoryId: category.id ?? "" }))
    setAddCategoryOpen(false)
    return null
  }

  return <>
  <AdminDialog title={title} description={mode === "create" ? "Add a product to your catalog." : mode === "edit" ? "Update the product information in your catalog." : undefined} onClose={onClose}>
    {readOnly ? <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
      <Detail label="Name" value={values.name} />
      <Detail label="SKU" value={values.sku} />
      <Detail label="Category" value={values.category} />
      <Detail label="Price" value={`₹${values.price.toLocaleString("en-IN")}`} />
      <Detail label="Product GST rate" value={values.taxRate == null ? "Use store rate" : `${values.taxRate}%`} />
      <Detail label="Stock" value={String(values.stock)} />
      <Detail label="Status" value={values.status} />
      <Detail label="Description" value={values.description} className="sm:col-span-2" />
      <div className="flex justify-end sm:col-span-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Close</button>
      </div>
    </div> : <form onSubmit={submit} className="grid gap-4 p-5">
      <label className="grid gap-1.5 text-sm">Name
        <input autoFocus required maxLength={120} value={values.name} onChange={(event) => change("name", event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
      </label>
      <label className="grid gap-1.5 text-sm">Description
        <textarea required rows={4} maxLength={2000} value={values.description} onChange={(event) => change("description", event.target.value)} className="resize-y rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
      </label>
      <label className="grid gap-1.5 text-sm">Product image URLs <span className="font-normal text-[#999]">Optional · one URL per line</span>
        <textarea rows={2} maxLength={20480} value={(values.images ?? []).join("\n")} onChange={(event) => change("images", event.target.value.split("\n").map((url) => url.trim()).filter(Boolean))} className="resize-y rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.featured ?? false} onChange={(event) => change("featured", event.target.checked)} className="accent-[#6f4e37]" /> Feature this product on the homepage</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid content-start gap-2 text-sm sm:col-span-2">
          <label htmlFor="product-category">Category</label>
          <Select.Root
            value={values.categoryId || null}
            required={!readOnly}
            disabled={!ready || readOnly}
            onValueChange={(value) => {
              if (value === ADD_CATEGORY_OPTION) {
                setAddCategoryOpen(true)
                return
              }
              const category = activeCategories.find((item) => item.id === value)
              if (category?.id) setValues((current) => ({ ...current, category: category.name, categoryId: category.id }))
            }}
          >
            <Select.Trigger
              id="product-category"
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#e6ddcc] bg-[#fffcf5] px-3 py-2.5 text-left outline-none transition-colors focus-visible:border-[#6f4e37] focus-visible:ring-2 focus-visible:ring-[#6f4e37]/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Select.Value placeholder="Select a category">
                {(value: string | null) => activeCategories.find((category) => category.id === value)?.name
                  ?? (value === values.categoryId ? productCategoryName : null)}
              </Select.Value>
              <Select.Icon><ChevronDown aria-hidden="true" className="size-4 shrink-0 text-[#777064]" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner sideOffset={4} align="start" className="z-[100] w-[var(--anchor-width)]">
                <Select.Popup className="max-h-64 overflow-hidden rounded-lg border border-[#e6ddcc] bg-white shadow-lg shadow-black/10">
                  <Select.List className="max-h-64 overflow-y-auto p-1.5">
                    {activeCategories.map((category) => <Select.Item
                      key={category.slug}
                      value={category.id ?? category.slug}
                      className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[#493323] outline-none data-[highlighted]:bg-[#f7f1e3] data-[selected]:font-medium"
                    >
                      <Select.ItemText className="truncate">{category.name}</Select.ItemText>
                      <Select.ItemIndicator><Check aria-hidden="true" className="size-4 text-[#6f4e37]" /></Select.ItemIndicator>
                    </Select.Item>)}
                    {values.categoryId && !activeCategories.some((category) => category.id === values.categoryId) && <Select.Item
                      value={values.categoryId}
                      disabled
                      className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[#493323] outline-none data-[highlighted]:bg-[#f7f1e3] data-[selected]:font-medium"
                    >
                      <Select.ItemText className="truncate">{productCategoryName === "Unavailable category" ? "Unavailable category · choose an active category" : productCategoryName}</Select.ItemText>
                      <Select.ItemIndicator><Check aria-hidden="true" className="size-4 text-[#6f4e37]" /></Select.ItemIndicator>
                    </Select.Item>}
                    <Select.Separator className="my-1.5 h-px bg-[#eee8dc]" />
                    <Select.Item
                      value={ADD_CATEGORY_OPTION}
                      label="Add New Category"
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#6f4e37] outline-none data-[highlighted]:bg-[#f7f1e3]"
                    >
                      <Plus aria-hidden="true" className="size-4 shrink-0" />
                      <Select.ItemText>Add New Category</Select.ItemText>
                    </Select.Item>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
        <label className="grid gap-1.5 text-sm">SKU
          <input required maxLength={64} value={values.sku} onChange={(event) => change("sku", event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
        </label>
        <label className="grid gap-1.5 text-sm">Price
          <input required type="number" min="0.01" step="any" value={values.price || ""} onChange={(event) => change("price", Number(event.target.value))} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
        </label>
        <label className="grid gap-1.5 text-sm">Product GST rate <span className="font-normal text-[#999]">Optional · blank uses the store rate</span>
          <input type="number" min="0" max="100" step="0.01" value={values.taxRate ?? ""} onChange={(event) => change("taxRate", event.target.value === "" ? null : Number(event.target.value))} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
        </label>
        <label className="grid gap-1.5 text-sm">Stock
          <input required type="number" min="0" step="1" value={values.stock} onChange={(event) => change("stock", Number(event.target.value))} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">Status
          <select value={values.status} onChange={(event) => change("status", event.target.value as AdminProductStatus)} className="rounded-lg border border-[#e8e6e0] bg-white px-3 py-2.5 outline-none focus:border-[#6f4e37]">
            {productStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="rounded-lg bg-[#fbeaea] px-3 py-2.5 text-sm text-[#a34d4d]">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-[#eee] pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#583b2b] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}
        </button>
      </div>
    </form>}
  </AdminDialog>
  {addCategoryOpen && <AddCategoryModal onClose={() => setAddCategoryOpen(false)} onCreate={createCategory} />}
  </>
}

function AddCategoryModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: Pick<ProductCategory, "name" | "description" | "imageUrl">) => Promise<string | null> | string | null
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    setImageError(null)
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setImageError("Choose a JPG, PNG, WebP, or GIF image.")
      return
    }
    if (file.size > MAX_CATEGORY_IMAGE_SIZE) {
      setImageError("Choose an image smaller than 1 MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setImageUrl(reader.result)
      else setImageError("The image could not be read. Please choose another file.")
    }
    reader.onerror = () => setImageError("The image could not be read. Please choose another file.")
    reader.readAsDataURL(file)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Category name is required.")
      return
    }
    setSubmitting(true)
    const result = await onCreate({ name, description, imageUrl })
    setSubmitting(false)
    if (result) setError(result)
  }

  return <AdminDialog
    title="Add category"
    description="Create a category and select it for this product."
    onClose={onClose}
    widthClassName="max-w-lg"
  >
    <form onSubmit={submit} className="grid gap-4 p-5">
      <label className="grid gap-1.5 text-sm">
        Category name
        <input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
      </label>
      <label className="grid gap-1.5 text-sm">
        Description <span className="font-normal text-[#999]">Optional</span>
        <textarea rows={3} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} className="resize-y rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]" />
      </label>
      <div className="grid gap-2 text-sm">
        <span>Category image <span className="font-normal text-[#999]">Optional</span></span>
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#d9cdb9] bg-[#fffcf5] p-3 sm:flex-row sm:items-center">
          {imageUrl ? (
            <div className="relative h-28 w-full overflow-hidden rounded-lg bg-[#f7f1e3] sm:w-36">
              <img src={imageUrl} alt="Category preview" className="size-full object-cover" />
              <button type="button" aria-label="Remove category image" onClick={() => { setImageUrl(null); setImageError(null) }} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#493323] shadow-sm hover:bg-white">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex h-24 w-full items-center justify-center rounded-lg bg-[#f7f1e3] text-[#9b8b73] sm:w-36">
              <ImagePlus className="size-7" aria-hidden="true" />
            </div>
          )}
          <div className="grid justify-items-start gap-1">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="h-9 gap-2 border-[#e6ddcc] bg-white text-[#493323] hover:bg-[#f7f1e3]">
              <ImagePlus className="size-4" /> {imageUrl ? "Change image" : "Upload image"}
            </Button>
            <p className="text-xs text-[#777064]">JPG, PNG, WebP, or GIF. Max 1 MB.</p>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} className="sr-only" />
          </div>
        </div>
        {imageError && <p role="alert" className="text-xs text-[#a34d4d]">{imageError}</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-[#fbeaea] px-3 py-2.5 text-sm text-[#a34d4d]">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-[#eee] pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#583b2b] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? "Creating…" : "Create category"}
        </button>
      </div>
    </form>
  </AdminDialog>
}

function Detail({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={className}><p className="text-xs text-[#999]">{label}</p><p className="mt-1 whitespace-pre-wrap text-[#333]">{value || "—"}</p></div>
}
