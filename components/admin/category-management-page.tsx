"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Archive, Pencil, Plus, Trash2 } from "lucide-react"
import { AdminDialog } from "@/components/admin/admin-interactions"
import { PageHeader, StatusBadge } from "@/components/admin/admin-primitives"
import { useCategoryData } from "@/components/category-data-provider"
import type { ProductCategory } from "@/lib/products"

type CategoryInput = Pick<ProductCategory, "name" | "description" | "imageUrl"> & {
  active: boolean
  priority: number
}

export function CategoryManagementPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<ProductCategory | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ProductCategory | null>(null)
  const [feedback, setFeedback] = useState("")
  const { refreshCategories } = useCategoryData()

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" })
      const data = await response.json() as { categories?: ProductCategory[]; error?: string }
      if (!response.ok) throw new Error(data.error ?? "Categories are temporarily unavailable.")
      setCategories(Array.isArray(data.categories) ? data.categories : [])
      setError("")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Categories are temporarily unavailable.")
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const visibleCategories = useMemo(() => {
    const term = query.trim().toLowerCase()
    return categories.filter((category) =>
      !term || `${category.name} ${category.slug} ${category.description}`.toLowerCase().includes(term),
    )
  }, [categories, query])

  const save = async (input: CategoryInput, id?: string) => {
    try {
      const response = await fetch(id ? `/api/admin/categories/${encodeURIComponent(id)}` : "/api/admin/categories", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? input : { ...input, active: true }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) return data.error ?? "The category could not be saved."
      await Promise.all([refresh(), refreshCategories()])
      setFeedback(id ? "Category updated." : "Category created.")
      setEditing(null)
      setCreating(false)
      return null
    } catch {
      return "The server could not be reached. Please try again."
    }
  }

  const remove = async (category: ProductCategory) => {
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(category.id ?? "")}`, { method: "DELETE" })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        setError(data.error ?? "The category could not be deleted.")
        return
      }
      await Promise.all([refresh(), refreshCategories()])
      setDeleting(null)
      setFeedback("Category deleted.")
      setError("")
    } catch {
      setError("The server could not be reached. Please try again.")
    }
  }

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader title="Categories" description="Organize storefront collections and manage their visibility." />
    {feedback && <p role="status" className="mb-4 rounded-lg bg-[#eaf4ed] px-4 py-3 text-sm text-[#3e7654]">{feedback}</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] px-4 py-3 text-sm text-[#a34d4d]">{error}</p>}
    <div className="mb-4 flex flex-col gap-3 sm:flex-row">
      <label className="flex flex-1 items-center rounded-lg border border-[#e8e6e0] bg-white px-3">
        <span className="sr-only">Search categories</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories..." className="w-full bg-transparent py-2.5 text-sm outline-none" />
      </label>
      <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm font-medium text-white"><Plus className="size-4" />Add category</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-[#e8e6e0] bg-white">
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-[#999]"><tr>{["Category", "Slug", "Products", "Order", "Status", ""].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody>
          {ready && visibleCategories.map((category) => <tr key={category.id} className="border-t border-[#f0eee9]">
            <td className="px-5 py-4"><p className="font-medium">{category.name}</p><p className="mt-1 max-w-md truncate text-xs text-[#777]">{category.description || "No description"}</p></td>
            <td className="px-5 py-4 text-[#777]">{category.slug}</td>
            <td className="px-5 py-4">{category.productCount}</td>
            <td className="px-5 py-4">{category.priority}</td>
            <td className="px-5 py-4"><StatusBadge tone={category.active ? "success" : "neutral"}>{category.active ? "Active" : "Inactive"}</StatusBadge></td>
            <td className="px-5 py-4"><div className="flex gap-2">
              <button type="button" onClick={() => setEditing(category)} aria-label={`Edit ${category.name}`} className="rounded-lg border border-[#e8e6e0] p-2 hover:bg-[#f7f6f2]"><Pencil className="size-4" /></button>
              {category.productCount === 0 && <button type="button" onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`} className="rounded-lg border border-[#e8e6e0] p-2 text-[#a34d4d] hover:bg-[#fbeaea]"><Trash2 className="size-4" /></button>}
              {category.productCount > 0 && <span title="Categories with products must be deactivated, not deleted." className="flex items-center px-2 text-xs text-[#999]"><Archive className="size-4" /></span>}
            </div></td>
          </tr>)}
          {!ready && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#777]">Loading categories…</td></tr>}
          {ready && visibleCategories.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-[#777]">{categories.length ? "No categories match this search." : "No categories have been created."}</td></tr>}
        </tbody>
      </table>
    </div>
    {(creating || editing) && <CategoryEditor
      category={editing ?? undefined}
      nextPriority={categories.length ? Math.max(...categories.map((category) => category.priority)) + 1 : 0}
      onClose={() => { setCreating(false); setEditing(null) }}
      onSave={(input) => save(input, editing?.id)}
    />}
    {deleting && <AdminDialog title="Delete category?" description={`Delete ${deleting.name}? Categories with products cannot be deleted; deactivate those instead.`} onClose={() => setDeleting(null)} widthClassName="max-w-md">
      <div className="flex justify-end gap-3 p-5">
        <button type="button" onClick={() => setDeleting(null)} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="button" onClick={() => void remove(deleting)} className="rounded-lg bg-[#a34d4d] px-4 py-2.5 text-sm text-white">Delete category</button>
      </div>
    </AdminDialog>}
  </div>
}

function CategoryEditor({
  category,
  nextPriority,
  onClose,
  onSave,
}: {
  category?: ProductCategory
  nextPriority: number
  onClose: () => void
  onSave: (input: CategoryInput) => Promise<string | null>
}) {
  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "")
  const [active, setActive] = useState(category?.active ?? true)
  const [priority, setPriority] = useState(String(category?.priority ?? nextPriority))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const result = await onSave({ name, description, imageUrl: imageUrl.trim() || null, active, priority: Number(priority) })
    setSaving(false)
    if (result) setError(result)
  }

  return <AdminDialog title={category ? "Edit category" : "Create category"} onClose={onClose} widthClassName="max-w-lg">
    <form onSubmit={submit} className="grid gap-4 p-5">
      <label className="grid gap-1.5 text-sm">Name
        <input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5" />
      </label>
      <div className="grid gap-1.5 text-sm"><label htmlFor="category-slug">Slug</label><input id="category-slug" readOnly value={name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")} className="rounded-lg border border-[#e8e6e0] bg-[#faf9f7] px-3 py-2.5 text-[#777]" /></div>
      <label className="grid gap-1.5 text-sm">Description
        <textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} className="resize-y rounded-lg border border-[#e8e6e0] px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm">Image URL
        <input type="text" maxLength={1_400_000} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm">Sort order
        <input required type="number" min="0" step="1" value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-lg border border-[#e8e6e0] px-3 py-2.5" />
      </label>
      {category && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="accent-[#6f4e37]" /> Active on the storefront</label>}
      {error && <p role="alert" className="rounded-lg bg-[#fbeaea] px-3 py-2.5 text-sm text-[#a34d4d]">{error}</p>}
      <div className="flex justify-end gap-3 border-t border-[#eee] pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm text-white disabled:opacity-60">{saving ? "Saving…" : category ? "Save changes" : "Create category"}</button>
      </div>
    </form>
  </AdminDialog>
}
