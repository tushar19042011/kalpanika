import Link from "next/link"
import { StorefrontShell } from "@/components/storefront-shell"
import type { Metadata } from "next"
import { getDatabase } from "@/lib/mongodb"
import type { CategoryDocument, ProductDocument } from "@/lib/store-models"

export const metadata: Metadata = {
  title: "Care Guide | Kalpanika",
  description: "General and product-specific care guidance for Kalpanika objects.",
}

export const dynamic = "force-dynamic"

export default async function CareGuidePage() {
  let products: Pick<ProductDocument, "name" | "slug" | "material" | "care">[] = []
  let loadError = false
  try {
    const database = await getDatabase()
    const categories = await database.collection<CategoryDocument>("categories")
      .find({ active: true })
      .project({ _id: 1 })
      .toArray()
    products = await database.collection<ProductDocument>("products")
      .find({ active: true, archived: { $ne: true }, categoryId: { $in: categories.map((item) => item._id) } })
      .project<Pick<ProductDocument, "name" | "slug" | "material" | "care">>({ name: 1, slug: 1, material: 1, care: 1 })
      .sort({ name: 1 })
      .limit(100)
      .toArray()
  } catch (error) {
    console.error("Could not load product care notes.", error)
    loadError = true
  }

  return <StorefrontShell>
    <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 md:px-10 md:py-24">
      <p className="eyebrow">Looking after your objects</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Care guide</h1>
      <div className="mt-8 border-t border-[#e6ddcc] pt-7 text-sm leading-7 text-[#777064]">
        <p>Care varies by material and design. Follow the item-specific instructions shown on its product page. Unless a product page says otherwise, keep 3D-printed pieces away from heat and open flames.</p>
        {loadError ? <p role="alert" className="mt-6 text-[#a34d4d]">Product-specific care notes are temporarily unavailable. Please open the relevant product page or try again later.</p> : (
          <div className="mt-8 grid gap-4">
            {products.filter((product) => product.care.trim()).map((product) => (
              <article key={product.slug} className="rounded-xl border border-[#e6ddcc] bg-white/70 p-5">
                <h2 className="font-medium text-[#493323]"><Link href={`/products/${encodeURIComponent(product.slug)}`} className="underline underline-offset-4">{product.name}</Link>{product.material && <span className="font-normal text-[#777064]"> · {product.material}</span>}</h2>
                <p className="mt-2">{product.care}</p>
              </article>
            ))}
            {!products.some((product) => product.care.trim()) && <p>No product-specific care notes are available yet.</p>}
          </div>
        )}
        <Link href="/products" className="mt-7 inline-flex rounded-full bg-[#493323] px-5 py-3 text-sm text-white">Browse product care notes</Link>
      </div>
    </main>
  </StorefrontShell>
}
