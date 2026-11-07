import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { StorefrontShell } from "@/components/storefront-shell"
import { AddToBagButton } from "@/components/add-to-bag-button"
import { ProductWishlistButton } from "@/components/product-wishlist-button"
import { getDatabase } from "@/lib/mongodb"
import { toCatalogProduct } from "@/lib/catalog"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"
import { formatPrice } from "@/lib/products"

export const dynamic = "force-dynamic"

export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let product
  let related
  try {
    const database = await getDatabase()
    const productDocument = await database.collection<ProductDocument>("products")
      .findOne({ slug, active: true })
    if (!productDocument) notFound()
    const category = await database.collection<CategoryDocument>("categories")
      .findOne({ _id: productDocument.categoryId, active: true })
    if (!category) notFound()
    product = toCatalogProduct(productDocument, category)
    const relatedDocuments = await database.collection<ProductDocument>("products")
      .find({
        _id: { $ne: productDocument._id },
        categoryId: productDocument.categoryId,
        active: true,
      })
      .sort({ featured: -1, createdAt: -1 })
      .limit(3)
      .toArray()
    related = relatedDocuments.map((item) => toCatalogProduct(item, category))
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error
    console.error("Could not load product details.", error)
    return (
      <StorefrontShell active="products">
        <main className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center">
          <p className="eyebrow">Product details</p>
          <h1 className="mt-3 text-3xl font-medium">This product is temporarily unavailable.</h1>
          <p className="mt-4 text-sm text-[#777064]">Please try again later or return to the collection.</p>
          <Link href="/products" className="mt-7 rounded-full bg-[#493323] px-6 py-3 text-sm text-white">Browse products</Link>
        </main>
      </StorefrontShell>
    )
  }

  return (
    <StorefrontShell active="products">
      <main className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-16">
        <Link href="/products" className="mb-10 inline-flex items-center gap-2 text-sm text-[#6f4e37]">
          <ArrowLeft className="size-4" /> Back to products
        </Link>
        <div className="grid gap-12 md:grid-cols-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#e9ddc5]">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
              : <div aria-hidden="true" className={`product-shape ${product.imageClass}`} />}
          </div>
          <div className="flex flex-col justify-center">
            <p className="eyebrow">{product.category}</p>
            <h1 className="mt-4 text-5xl font-medium tracking-[-.06em] md:text-7xl">{product.name}</h1>
            <p className="mt-5 text-xl">{formatPrice(product.price)}</p>
            <p className="mt-7 max-w-md leading-7 text-[#777064]">{product.note}</p>
            <div className="mt-12 grid gap-4 border-t border-[#e6ddcc] pt-6 text-sm">
              <div className="flex justify-between"><span className="text-[#777064]">Material</span><span>{product.material}</span></div>
              <div className="flex justify-between"><span className="text-[#777064]">Dimensions</span><span>{product.dimensions}</span></div>
              <div className="flex justify-between"><span className="text-[#777064]">Care</span><span>{product.care}</span></div>
              <div className="flex justify-between"><span className="text-[#777064]">Availability</span><span>{product.stock ? `${product.stock} in stock` : "Out of stock"}</span></div>
            </div>
            <div className="mt-8 flex gap-3">
              <AddToBagButton slug={product.slug} />
              <ProductWishlistButton slug={product.slug} name={product.name} />
            </div>
          </div>
        </div>
        {related.length > 0 && (
          <section className="mt-28 border-t border-[#e6ddcc] pt-10">
            <p className="eyebrow">You may also like</p>
            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3">
              {related.map((item) => (
                <Link key={item.slug} href={`/products/${item.slug}`} className="group">
                  <div className="flex aspect-square items-center justify-center overflow-hidden bg-[#f7f1e3] transition-transform group-hover:-translate-y-1">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                      : <div className={`product-shape ${item.imageClass}`} />}
                  </div>
                  <p className="mt-4 text-sm">{item.name}</p>
                  <p className="mt-1 text-sm text-[#777064]">{formatPrice(item.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </StorefrontShell>
  )
}
