"use client";

import { CategoryCard } from "@/components/category-card";
import { StorefrontShell } from "@/components/storefront-shell";
import { useCategoryData } from "@/components/category-data-provider";

export default function CategoryPage() {
  const { categories, ready, error } = useCategoryData();
  const activeCategories = categories.filter((category) => category.active);

  return (
    <StorefrontShell active="category">
      <main>
        <section className="mx-auto max-w-[1440px] px-5 pb-10 pt-12 sm:pb-14 md:px-10 md:pt-20">
          <p className="eyebrow">Explore the collection</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[2.8rem] font-medium leading-[.98] tracking-[-.06em] sm:text-5xl md:text-6xl">
                Explore <em className="font-serif font-normal">Categories</em>
              </h1>
              <p className="mt-4 text-sm text-[#777064] sm:text-base">
                Find something made for your world.
              </p>
            </div>
            <p className="text-xs text-[#777064]">
              {activeCategories.length} considered collections
            </p>
          </div>
        </section>
        <section className="border-t border-[#e6ddcc] bg-[#fffcf5] px-5 py-8 sm:py-12 md:px-10 md:py-14">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {activeCategories.map((category) => (
              <CategoryCard key={category.slug} category={category} />
            ))}
          </div>
          {error ? (
            <p role="alert" className="mx-auto mt-8 max-w-3xl text-center text-sm text-[#a34d4d]">{error}</p>
          ) : !ready ? (
            <p role="status" className="mx-auto mt-8 max-w-3xl text-center text-sm text-[#777064]">Loading categories…</p>
          ) : activeCategories.length === 0 ? (
            <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-[#777064]">Categories will appear here as they are added.</p>
          ) : null}
        </section>
      </main>
    </StorefrontShell>
  );
}
