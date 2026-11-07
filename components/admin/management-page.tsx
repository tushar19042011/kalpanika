"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Eye, LoaderCircle, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { AdminDialog, AdminDropdown } from "@/components/admin/admin-interactions"
import { useAdminData } from "@/components/admin/admin-data-provider"
import { PageHeader, Toolbar, StatusBadge } from "@/components/admin/admin-primitives"
import { ProductDialog, type ProductFormValues } from "@/components/admin/product-dialog"
import {
  fulfillmentStatuses,
  fulfillmentTransitions,
  money,
  productStatuses,
  type AdminOrder,
  type AdminProduct,
} from "@/lib/admin-data"

type Kind = "products" | "orders" | "inventory"

export function ManagementPage({ kind }: { kind: Kind }) {
  const router = useRouter()
  const config = {
    products: { title: "Products", description: "Manage your catalog, pricing, and availability.", action: "Add product", href: "/admin/products/new" },
    orders: { title: "Orders", description: "Track every order from confirmation to delivery." },
    inventory: { title: "Inventory", description: "Monitor stock levels and make adjustments." },
  }[kind]
  const { products, orders, ready, storageError, notice, setNotice, addProduct, updateProduct, deleteProduct, setProductStatus, setProductStock, setFulfillmentStatus, setOrderArchived } = useAdminData()
  const [dialog, setDialog] = useState<{ mode: "edit" | "view"; product: AdminProduct } | null>(null)
  const [pendingArchive, setPendingArchive] = useState<AdminOrder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null)
  const [stockProduct, setStockProduct] = useState<AdminProduct | null>(null)
  const [stockValue, setStockValue] = useState("")
  const [stockError, setStockError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [savingStatusKey, setSavingStatusKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const filterOptions = kind === "products"
    ? [{ label: "All visibility", value: "" }, ...productStatuses.map((status) => ({ label: status, value: status }))]
    : kind === "orders"
      ? [{ label: "All fulfillment", value: "" }, ...fulfillmentStatuses.map((status) => ({ label: status, value: status })), { label: "Archived", value: "archived" }]
      : kind === "inventory"
        ? [{ label: "All stock", value: "" }, { label: "Low stock", value: "low" }, { label: "Out of stock", value: "out" }, { label: "In stock", value: "available" }]
        : undefined
  const normalizedQuery = query.trim().toLowerCase()
  const visibleProducts = products.filter((product) =>
    (!normalizedQuery || `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(normalizedQuery))
    && (!filter || (kind === "inventory"
      ? filter === "low" ? product.stock > 0 && product.stock < 5 : filter === "out" ? product.stock === 0 : product.stock >= 5
      : product.status === filter)),
  )
  const visibleOrders = orders.filter((order) =>
    (!normalizedQuery || `${order.id} ${order.customer} ${order.email ?? ""}`.toLowerCase().includes(normalizedQuery))
    && (filter === "archived" ? order.archived === true : !order.archived && (!filter || order.status === filter)),
  )

  useEffect(() => {
    if (!notice) return
    setFeedback({ message: notice, error: false })
    setNotice(null)
  }, [notice, setNotice])

  const saveProduct = async (values: ProductFormValues) => {
    if (!dialog) return "Select a product before saving."
    const result = await (dialog.mode === "edit" ? updateProduct(dialog.product.id, values) : addProduct(values))
    if (!result) setFeedback({ message: dialog.mode === "edit" ? "Product updated." : "Product added.", error: false })
    return result
  }
  const notifyUpdate = async (result: Promise<string | null> | string | null, successMessage: string) => {
    const error = await result
    setFeedback({ message: error ?? successMessage, error: Boolean(error) })
    return error
  }
  const saveStatus = async (key: string, update: () => Promise<string | null>, successMessage: string) => {
    setSavingStatusKey(key)
    const error = await update()
    setFeedback({ message: error ?? successMessage, error: Boolean(error) })
    setSavingStatusKey(null)
  }
  const openStockEditor = (product: AdminProduct) => {
    setStockProduct(product)
    setStockValue(String(product.stock))
    setStockError(null)
  }
  const saveStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stockProduct) return
    const stock = Number(stockValue)
    if (!Number.isInteger(stock) || stock < 0) {
      setStockError("Stock must be a non-negative whole number.")
      return
    }
    const result = await setProductStock(stockProduct.id, stock)
    if (result) {
      setStockError(result)
      return
    }
    setFeedback({ message: `${stockProduct.name} stock updated.`, error: false })
    setStockProduct(null)
  }

  return <div className="mx-auto max-w-[1440px]">
    <PageHeader {...config} />
    {storageError && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] px-4 py-3 text-sm text-[#a34d4d]">Admin data could not be saved or loaded: {storageError}</p>}
    {feedback && <p role={feedback.error ? "alert" : "status"} className={`mb-4 rounded-lg px-4 py-3 text-sm ${feedback.error ? "bg-[#fbeaea] text-[#a34d4d]" : "bg-[#eaf4ed] text-[#3e7654]"}`}>{feedback.message}</p>}
    <Toolbar
      placeholder={`Search ${kind}...`}
      value={query}
      onChange={setQuery}
      filterOptions={filterOptions}
      filterValue={filter}
      onFilterChange={setFilter}
    />

    {kind === "products" && <div className="overflow-x-auto rounded-xl border border-[#e8e6e0] bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-[#999]"><tr>{["Product", "SKU", "Category", "Price", "Stock", "Status", "Updated", ""].map((x) => <th key={x} className="px-5 py-3 font-medium">{x}</th>)}</tr></thead>
        <tbody>
          {ready && visibleProducts.map((product) => <tr key={product.id} className="border-t border-[#f0eee9]">
            <td className="px-5 py-4 font-medium"><div className="flex items-center gap-3"><div className="size-9 shrink-0 rounded-lg bg-[#f1ebe4]" />{product.name}</div></td>
            <td className="px-5 py-4 text-[#777]">{product.sku}</td>
            <td className="px-5 py-4 text-[#777]">{product.category}</td>
            <td className="px-5 py-4">{money(product.price)}</td>
            <td className="px-5 py-4">
              <button type="button" aria-label={`Edit stock for ${product.name}`} onClick={() => openStockEditor(product)} className={`rounded-md px-2 py-1 outline-offset-2 transition-colors hover:bg-[#f7f1e3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f4e37] ${product.stock < 5 ? "font-medium text-[#a97b4c]" : ""}`}>
                {product.stock}
              </button>
            </td>
            <td className="px-5 py-4">
              <AdminDropdown
                label={`Change status for ${product.name}`}
                disabled={savingStatusKey !== null}
                triggerClassName="cursor-pointer rounded-full outline-offset-2 hover:ring-2 hover:ring-[#6f4e37]/20 focus-visible:ring-2 focus-visible:ring-[#6f4e37]"
                trigger={<StatusBadge tone={product.status === "Active" ? "success" : "neutral"}>{savingStatusKey === `product:${product.id}` && <LoaderCircle aria-hidden="true" className="mr-1 size-3 animate-spin" />}{product.status}</StatusBadge>}
                options={productStatuses.map((status) => ({
                  label: status,
                  selected: status === product.status,
                  disabled: savingStatusKey !== null,
                  onSelect: () => { void saveStatus(`product:${product.id}`, () => setProductStatus(product.id, status), `${product.name} is now ${status.toLowerCase()}.`) },
                }))}
              />
            </td>
            <td className="px-5 py-4 text-[#777]">{product.updated}</td>
            <td className="px-5 py-4">
              <AdminDropdown
                label={`Actions for ${product.name}`}
                triggerClassName="rounded-lg p-1.5 text-[#999] hover:bg-[#f5f3ef] hover:text-[#191919]"
                trigger={<MoreHorizontal aria-hidden="true" className="size-5" />}
                options={[
                  { label: "Edit Product", icon: Pencil, onSelect: () => setDialog({ mode: "edit", product }) },
                  { label: "View Product", icon: Eye, onSelect: () => setDialog({ mode: "view", product }) },
                  { label: "Archive Product", icon: Trash2, destructive: true, onSelect: () => { setDeleteError(null); setPendingDelete(product) } },
                ]}
              />
            </td>
          </tr>)}
          {ready && visibleProducts.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#777]">{products.length === 0 ? "No products in the catalog yet." : "No products match these filters."}</td></tr>}
          {!ready && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#777]">Loading products…</td></tr>}
        </tbody>
      </table>
    </div>}

    {kind === "orders" && <div className="overflow-x-auto rounded-xl border border-[#e8e6e0] bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-[#faf9f7] text-xs text-[#999]"><tr>{["Order", "Customer", "Date", "Items", "Total", "Payment", "Fulfillment", ""].map((x) => <th key={x} className="px-5 py-3 font-medium">{x}</th>)}</tr></thead>
        <tbody>{ready && visibleOrders.map((order) => <tr key={order.id} className="border-t border-[#f0eee9]">
          <td className="px-5 py-4 font-medium"><Link href={`/admin/orders/${order.id.replace(/^#/, "")}`} className="text-[#6f4e37]">{order.id}</Link></td>
          <td className="px-5 py-4">{order.customer}</td>
          <td className="px-5 py-4 text-[#777]">{order.date}</td>
          <td className="px-5 py-4 text-[#777]">{order.items}</td>
          <td className="px-5 py-4">{money(order.total)}</td>
          <td className="px-5 py-4" title="Read-only. Payment status is controlled by verified payment provider events."><StatusBadge tone={order.payment === "Paid" ? "success" : "warning"}>{order.payment}</StatusBadge></td>
          <td className="px-5 py-4">
            <AdminDropdown
              label={`Change fulfillment status for order ${order.id}`}
              disabled={savingStatusKey !== null}
              triggerClassName="cursor-pointer rounded-full outline-offset-2 hover:ring-2 hover:ring-[#6f4e37]/20 focus-visible:ring-2 focus-visible:ring-[#6f4e37]"
              trigger={<StatusBadge tone={fulfillmentTone(order.status)}>{savingStatusKey === `order:${order.id}` && <LoaderCircle aria-hidden="true" className="mr-1 size-3 animate-spin" />}{order.status}</StatusBadge>}
              options={fulfillmentStatuses.map((status) => {
                const transitionAllowed = status === order.status || fulfillmentTransitions[order.status].includes(status)
                return {
                label: status,
                selected: status === order.status,
                disabled: savingStatusKey !== null || !transitionAllowed,
                disabledReason: transitionAllowed ? undefined : `Cannot move from ${order.status} to ${status}.`,
                onSelect: () => { void saveStatus(`order:${order.id}`, () => setFulfillmentStatus(order.id, status), `Fulfillment status updated to ${status.toLowerCase()}.`) },
              }})}
            />
          </td>
          <td className="px-5 py-4">
            <AdminDropdown
              label={`Actions for order ${order.id}`}
              triggerClassName="rounded-lg p-1.5 text-[#999] hover:bg-[#f5f3ef] hover:text-[#191919]"
              trigger={<MoreHorizontal aria-hidden="true" className="size-5" />}
              options={[
                { label: "View Order", icon: Eye, onSelect: () => router.push(`/admin/orders/${order.id.replace(/^#/, "")}`) },
                {
                  label: order.archived ? "Restore Order" : "Archive Order",
                  icon: order.archived ? RotateCcw : Archive,
                  destructive: !order.archived,
                  onSelect: () => {
                    setArchiveError(null)
                    setPendingArchive(order)
                  },
                },
              ]}
            />
          </td>
        </tr>)}
          {ready && visibleOrders.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#777]">{orders.length === 0 ? "No orders found." : "No orders match these filters."}</td></tr>}
          {!ready && <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[#777]">Loading orders…</td></tr>}
        </tbody>
      </table>
    </div>}

    {kind === "inventory" && <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <div className="overflow-x-auto rounded-xl border border-[#e8e6e0] bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#faf9f7] text-xs text-[#999]"><tr><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">SKU</th><th className="px-5 py-3 font-medium">Current stock</th><th className="px-5 py-3 font-medium">Status</th><th /></tr></thead><tbody>{visibleProducts.map((product) => <tr key={product.id} className="border-t border-[#f0eee9]"><td className="px-5 py-4 font-medium"><div className="flex items-center gap-3"><div className="size-9 rounded-lg bg-[#f1ebe4]" />{product.name}</div></td><td className="px-5 py-4 text-[#777]">{product.sku}</td><td className="px-5 py-4 font-medium"><button type="button" aria-label={`Edit stock for ${product.name}`} onClick={() => openStockEditor(product)} className="rounded-md px-2 py-1 outline-offset-2 hover:bg-[#f7f1e3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f4e37]">{product.stock}</button></td><td className="px-5 py-4"><StatusBadge tone={product.stock === 0 ? "danger" : product.stock < 5 ? "warning" : "success"}>{product.stock === 0 ? "Out of stock" : product.stock < 5 ? "Low stock" : "In stock"}</StatusBadge></td><td className="px-5 py-4"><button type="button" onClick={() => openStockEditor(product)} className="rounded-lg border border-[#e8e6e0] px-3 py-1.5 text-xs hover:border-[#6f4e37]">Adjust</button></td></tr>)}{ready && visibleProducts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-[#777]">{products.length ? "No inventory matches these filters." : "No products in inventory."}</td></tr>}</tbody></table></div>
      <div className="h-fit rounded-xl border border-[#eadfca] bg-[#fffaf0] p-5"><h3 className="font-semibold text-[#6f4e37]">Low-stock alert</h3><p className="mt-2 text-sm text-[#8c6c40]">{products.filter((product) => product.stock < 5).length} products are below their threshold. Review inventory before the next production run.</p><Link href="/admin/products" className="mt-4 inline-block text-xs font-medium text-[#6f4e37]">View products →</Link></div>
    </div>}

    {dialog && <ProductDialog
      key={`${dialog.mode}-${dialog.product.id}`}
      product={dialog.product}
      mode={dialog.mode}
      onClose={() => setDialog(null)}
      onSave={saveProduct}
    />}
    {stockProduct && <AdminDialog
      title="Adjust stock"
      description={`Update inventory for ${stockProduct.name}.`}
      onClose={() => setStockProduct(null)}
      widthClassName="max-w-md"
    >
      <form onSubmit={saveStock} className="grid gap-4 p-5">
        <label className="grid gap-1.5 text-sm" htmlFor="product-stock">Stock quantity
          <input
            id="product-stock"
            autoFocus
            required
            type="number"
            min="0"
            step="1"
            value={stockValue}
            onChange={(event) => setStockValue(event.target.value)}
            className="rounded-lg border border-[#e8e6e0] px-3 py-2.5 outline-none focus:border-[#6f4e37]"
          />
        </label>
        {stockError && <p role="alert" className="rounded-lg bg-[#fbeaea] px-3 py-2.5 text-sm text-[#a34d4d]">{stockError}</p>}
        <div className="flex justify-end gap-3 border-t border-[#eee] pt-4">
          <button type="button" onClick={() => setStockProduct(null)} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
          <button type="submit" className="rounded-lg bg-[#6f4e37] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#583b2b]">Save stock</button>
        </div>
      </form>
    </AdminDialog>}
    {pendingDelete && <AdminDialog title="Archive product?" description={`${pendingDelete.name} will be hidden from the storefront. Existing order snapshots will be retained.`} onClose={() => setPendingDelete(null)} widthClassName="max-w-md">
      <div className="flex justify-end gap-3 p-5">
        {deleteError && <p role="alert" className="mr-auto self-center text-sm text-[#a34d4d]">{deleteError}</p>}
        <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="button" onClick={() => {
          void notifyUpdate(deleteProduct(pendingDelete.id), `${pendingDelete.name} archived.`).then((error) => {
            if (!error) setPendingDelete(null)
            else setDeleteError(error)
          })
        }} className="rounded-lg bg-[#a34d4d] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#883d3d]">Archive product</button>
      </div>
    </AdminDialog>}
    {pendingArchive && <AdminDialog
      title={pendingArchive.archived ? "Restore order?" : "Archive order?"}
      description={pendingArchive.archived
        ? `${pendingArchive.id} will return to the active orders list. Its history and analytics remain unchanged.`
        : `${pendingArchive.id} will be hidden from the active orders list. It will remain in order history and analytics.`}
      onClose={() => setPendingArchive(null)}
      widthClassName="max-w-md"
    >
      <div className="flex justify-end gap-3 p-5">
        {archiveError && <p role="alert" className="mr-auto self-center text-sm text-[#a34d4d]">{archiveError}</p>}
        <button type="button" onClick={() => setPendingArchive(null)} className="rounded-lg border border-[#e8e6e0] px-4 py-2.5 text-sm">Cancel</button>
        <button type="button" onClick={() => {
          const archived = !pendingArchive.archived
          void notifyUpdate(setOrderArchived(pendingArchive.id, archived), archived ? "Order archived." : "Order restored.").then((error) => {
            if (!error) setPendingArchive(null)
            else setArchiveError(error)
          })
        }} className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white ${pendingArchive.archived ? "bg-[#6f4e37] hover:bg-[#583b2b]" : "bg-[#a34d4d] hover:bg-[#883d3d]"}`}>
          {pendingArchive.archived ? "Restore order" : "Archive order"}
        </button>
      </div>
    </AdminDialog>}
  </div>
}

function fulfillmentTone(status: string) {
  if (status === "Delivered") return "success"
  if (status === "Cancelled") return "danger"
  return "warning"
}
