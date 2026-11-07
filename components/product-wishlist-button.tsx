"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/components/storefront-shell";

export function ProductWishlistButton({ slug, name }: { slug: string; name: string }) {
  const { wishlistIds, toggleWishlist } = useWishlist();
  const isWishlisted = wishlistIds.includes(slug);

  return (
    <button
      type="button"
      aria-label={`${isWishlisted ? "Remove" : "Add"} ${name} ${isWishlisted ? "from" : "to"} wishlist`}
      aria-pressed={isWishlisted}
      onClick={() => toggleWishlist(slug)}
      className="icon-button border border-[#e6ddcc]"
    >
      <Heart
        className={isWishlisted ? "fill-[#6f4e37] text-[#6f4e37]" : ""}
      />
    </button>
  );
}
