import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProductCategory } from "@/lib/products";

export function CategoryCard({ category }: { category: ProductCategory }) {
  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="group block min-w-0"
      aria-label={`Explore ${category.name}, ${category.productCount} ${category.productCount === 1 ? "object" : "objects"}`}
    >
      <div
        className={`relative flex aspect-[1.22] items-center justify-center overflow-hidden ${category.imageBackground}`}
      >
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : category.imageClass ? (
          <div className="transition-transform duration-500 group-hover:scale-110">
            <div aria-hidden="true" className={`product-shape ${category.imageClass}`}>
              <span />
            </div>
          </div>
        ) : (
          <p className="px-8 text-center text-sm text-[#777064]">
            New forms coming soon
          </p>
        )}
        <span className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-[#fffcf5]/80 text-[#493323] transition-colors group-hover:bg-[#493323] group-hover:text-[#fffcf5]">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 border-b border-[#e6ddcc] py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium tracking-[-0.02em] text-[#191919] sm:text-lg">
            {category.name}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#777064]">
            {category.description}
          </p>
        </div>
        <span className="shrink-0 pt-1 text-[11px] text-[#777064]">
          {category.productCount}{" "}
          {category.productCount === 1 ? "object" : "objects"}
        </span>
      </div>
    </Link>
  );
}
