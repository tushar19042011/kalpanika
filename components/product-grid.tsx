"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { formatPrice, type Product } from "@/lib/products";
import { useCart, useWishlist } from "@/components/storefront-shell";

function ProductShape({ className }: { className: string }) {
  return (
    <div aria-hidden="true" className={`product-shape ${className}`}>
      <span />
    </div>
  );
}

export function ProductGrid({
  products,
  className = "grid grid-cols-2 gap-x-3 gap-y-16 md:grid-cols-4 md:gap-x-5 md:gap-y-8",
  imageBackgrounds,
  openCartOnAdd = false,
}: {
  products: Product[];
  className?: string;
  imageBackgrounds?: string[];
  openCartOnAdd?: boolean;
}) {
  return (
    <div className={className}>
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          shapeClass={product.imageClass}
          imageBackground={imageBackgrounds?.[index] ?? "bg-[#e9ddc5]"}
          openCartOnAdd={openCartOnAdd}
        />
      ))}
    </div>
  );
}

function ProductCard({
  product,
  shapeClass,
  imageBackground,
  openCartOnAdd,
}: {
  product: Product;
  shapeClass: string;
  imageBackground: string;
  openCartOnAdd: boolean;
}) {
  const { addToBag, openCart } = useCart();
  const { wishlistIds, toggleWishlist } = useWishlist();
  const [added, setAdded] = useState(false);
  const isWishlisted = wishlistIds.includes(product.slug);

  const handleQuickAdd = async () => {
    if (!await addToBag(product.slug)) return;
    if (openCartOnAdd) openCart();
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <article className="group">
      <div className={`relative aspect-[0.86] overflow-hidden ${imageBackground}`}>
        <Link
          href={`/products/${product.slug}`}
          aria-label={`View ${product.name}`}
          className="absolute inset-0"
        >
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="size-full object-cover transition-transform group-hover:scale-105" />
            : <ProductShape className={shapeClass} />}
        </Link>
        <button
          type="button"
          aria-label={`${isWishlisted ? "Remove" : "Add"} ${product.name} ${isWishlisted ? "from" : "to"} wishlist`}
          aria-pressed={isWishlisted}
          onClick={() => toggleWishlist(product.slug)}
          className="absolute right-3 top-3 z-20 rounded-full bg-[#fffcf5]/80 p-2 backdrop-blur-sm"
        >
          <Heart
            className={`size-4 ${isWishlisted ? "fill-[#6f4e37] text-[#6f4e37]" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={() => void handleQuickAdd()}
          disabled={product.active === false || !product.stock}
          className="absolute bottom-3 left-3 right-3 z-20 translate-y-2 bg-[#493323] py-3 text-xs text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!product.stock ? "Out of stock" : added ? "Added to bag" : "Quick add"}
        </button>
      </div>
      <div className="flex items-start justify-between gap-3 pt-4">
        <div>
          <Link href={`/products/${product.slug}`} className="text-sm md:text-base">
            {product.name}
          </Link>
          <p className="mt-1 text-xs text-[#777064]">{product.category}</p>
        </div>
        <p className="whitespace-nowrap text-sm">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
