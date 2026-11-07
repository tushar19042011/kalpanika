"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { StorefrontShell, useWishlist } from "@/components/storefront-shell";
import { useCategoryData } from "@/components/category-data-provider";

export default function WishlistPage() {
  return (
    <StorefrontShell>
      <WishlistContent />
    </StorefrontShell>
  );
}

function WishlistContent() {
  const { wishlistIds, wishlistReady, wishlistError } = useWishlist();
  const { products, error } = useCategoryData();
  const savedProducts = products.filter((product) =>
    wishlistIds.includes(product.slug),
  );

  if (!wishlistReady) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-[1440px] px-5 py-16 md:px-10">
        <div className="h-8 w-48 animate-pulse rounded bg-[#f1e6d2]" />
      </main>
    );
  }

  if (savedProducts.length === 0) {
    return (
      <main className="mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-5 py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#f7f1e3] text-[#6f4e37]">
          <Heart className="size-7" />
        </div>
        <p className="eyebrow mt-7">Your wishlist</p>
        <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em]">
          {error || wishlistError ? "Wishlist unavailable." : "Nothing saved yet."}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#777064]">
          {error || wishlistError ? error || wishlistError : "Good things are worth keeping. Explore our collection and save the pieces you love."}
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#493323] px-6 py-3 text-sm text-white"
        >
          Explore products <ArrowRight className="size-4" />
        </Link>
      </main>
    );
  }

  return (
    <main>
      <section className="mx-auto max-w-[1440px] px-5 pb-6 pt-8 sm:pt-12 md:px-10 md:pt-14">
        <p className="eyebrow">Your wishlist</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="text-[2.55rem] font-medium leading-[.98] tracking-[-.06em] sm:text-5xl md:text-6xl">
            Things worth keeping.
          </h1>
          <p className="shrink-0 text-xs text-[#777064]">
            {savedProducts.length} {savedProducts.length === 1 ? "object" : "objects"}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">
        <ProductGrid products={savedProducts} />
      </section>
    </main>
  );
}
