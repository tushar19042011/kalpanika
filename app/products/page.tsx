"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useCategoryData } from "@/components/category-data-provider";
import { ProductGrid } from "@/components/product-grid";
import { StorefrontShell } from "@/components/storefront-shell";
import type { Product } from "@/lib/products";

type CatalogResponse = {
  products?: Product[];
  total?: number;
  pages?: number;
  error?: string;
};

export default function ProductsPage() {
  return (
    <StorefrontShell active="products">
      <Suspense fallback={<ProductsLoading />}>
        <ProductsContent />
      </Suspense>
    </StorefrontShell>
  );
}

function ProductsLoading() {
  return (
    <main className="mx-auto min-h-[50vh] max-w-[1440px] px-5 py-16 text-sm text-[#777064] md:px-10">
      Loading the collection...
    </main>
  );
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories } = useCategoryData();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({
    category: "",
    minPrice: "",
    maxPrice: "",
    inStock: false,
    sort: "featured",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedSlug = searchParams.get("category");
  const selectedCategory = categories.find(
    (item) => item.active && item.slug === selectedSlug,
  );
  const sort = searchParams.get("sort") ?? "featured";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const paramsKey = searchParams.toString();
  const activeFilterCount = [
    selectedSlug,
    searchParams.get("minPrice"),
    searchParams.get("maxPrice"),
    searchParams.get("inStock") === "true" ? "inStock" : null,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(paramsKey);
    params.set("limit", "24");
    setLoading(true);
    setError("");
    fetch(`/api/catalog?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as CatalogResponse;
        if (!response.ok) throw new Error(data.error ?? "The collection is temporarily unavailable.");
        setProducts(Array.isArray(data.products) ? data.products : []);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setPages(typeof data.pages === "number" ? data.pages : 0);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "The collection is temporarily unavailable.");
        setProducts([]);
        setTotal(0);
        setPages(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [paramsKey]);

  const changeParameter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `/products?${queryString}` : "/products", { scroll: false });
  };
  const changeQuery = (value: string) => {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    params.delete("page");
    const queryString = params.toString();
    router.replace(queryString ? `/products?${queryString}` : "/products", { scroll: false });
  };
  const openFilters = () => {
    setFilterDraft({
      category: searchParams.get("category") ?? "",
      minPrice: searchParams.get("minPrice") ?? "",
      maxPrice: searchParams.get("maxPrice") ?? "",
      inStock: searchParams.get("inStock") === "true",
      sort: searchParams.get("sort") ?? "featured",
    });
    setFiltersOpen(true);
  };
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["category", "minPrice", "maxPrice", "inStock", "sort", "page"]) {
      params.delete(key);
    }
    if (filterDraft.category) params.set("category", filterDraft.category);
    if (filterDraft.minPrice.trim()) params.set("minPrice", filterDraft.minPrice.trim());
    if (filterDraft.maxPrice.trim()) params.set("maxPrice", filterDraft.maxPrice.trim());
    if (filterDraft.inStock) params.set("inStock", "true");
    if (filterDraft.sort !== "featured") params.set("sort", filterDraft.sort);
    const queryString = params.toString();
    router.replace(queryString ? `/products?${queryString}` : "/products", { scroll: false });
    setFiltersOpen(false);
  };
  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["category", "minPrice", "maxPrice", "inStock", "sort", "page"]) {
      params.delete(key);
    }
    const queryString = params.toString();
    router.replace(queryString ? `/products?${queryString}` : "/products", { scroll: false });
    setFilterDraft({ category: "", minPrice: "", maxPrice: "", inStock: false, sort: "featured" });
    setFiltersOpen(false);
  };
  const statusMessage = useMemo(() => {
    if (loading) return "Loading products…";
    if (error) return error;
    if (products.length === 0) return selectedCategory && !query
      ? "No objects in this category match the selected filters."
      : query ? "No objects match that search and filter combination."
        : activeFilterCount ? "No products match your filters." : "No products are available yet.";
    return "";
  }, [loading, error, products.length, selectedCategory, query, activeFilterCount]);

  return (
    <main>
      <section className="mx-auto max-w-[1440px] px-5 pb-6 pt-8 sm:pt-12 md:px-10 md:pt-14">
        <p className="eyebrow">The Kalpanika collection</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="max-w-3xl text-[2.55rem] font-medium leading-[.98] tracking-[-.06em] sm:text-5xl md:text-6xl">
              {selectedCategory ? (
                <>{selectedCategory.name} <em className="font-serif font-normal">objects.</em></>
              ) : (
                <>Objects made <em className="font-serif font-normal">to inspire.</em></>
              )}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#777064] sm:leading-7">
              {selectedCategory
                ? selectedCategory.description
                : "Thoughtfully designed objects made with 3D printing, for the spaces and rituals that make a place yours."}
            </p>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => changeParameter("category", null)}
                className="mt-3 text-xs text-[#6f4e37] underline underline-offset-4"
              >
                Clear category filter
              </button>
            )}
          </div>
          <p className="text-xs text-[#777064]">
            {loading ? "Loading…" : `${total} ${total === 1 ? "object" : "objects"} / 2026 edition`}
          </p>
        </div>
      </section>
      <section className="border-y border-[#e6ddcc] bg-[#f7f1e3] px-5 py-4 md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => changeParameter("category", null)}
              aria-pressed={!selectedSlug}
              className={`whitespace-nowrap border px-3 py-2 text-xs ${!selectedSlug ? "border-[#493323] bg-[#493323] text-[#fffcf5]" : "border-[#e6ddcc]"}`}
            >
              All Products
            </button>
            {categories.filter((item) => item.active).map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => changeParameter("category", item.slug)}
                aria-pressed={selectedSlug === item.slug}
                className={`whitespace-nowrap border px-3 py-2 text-xs ${selectedSlug === item.slug ? "border-[#493323] bg-[#493323] text-[#fffcf5]" : "border-[#e6ddcc]"}`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openFilters}
            className="flex items-center gap-2 text-sm md:hidden"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 border-b border-[#493323] pb-2 md:w-80">
            <Search className="size-4" />
            <input
              aria-label="Search products"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="Search collection"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#777064]"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => changeQuery("")}>
                <X className="size-4" />
              </button>
            )}
          </div>
          <label className="flex items-center justify-between gap-3 self-end sm:justify-end">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-[#777064]">Sort by</span>
            <span className="relative">
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(event) => changeParameter("sort", event.target.value === "featured" ? null : event.target.value)}
              className="min-w-52 appearance-none rounded-lg border border-[#e6ddcc] bg-[#f7f1e3] py-3 pl-4 pr-11 text-sm font-medium text-[#493323] shadow-sm outline-none transition-colors hover:border-[#cbbb9f] focus:border-[#6f4e37] focus:ring-2 focus:ring-[#d8c47a]/40"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#6f4e37]" />
            </span>
          </label>
        </div>
        {filtersOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
              className="absolute inset-0 bg-[#493323]/35"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-filters-title"
              className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#fffcf5] p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-[#e6ddcc] pb-4">
                <div>
                  <h2 id="mobile-filters-title" className="text-xl font-medium">Filters</h2>
                  <p className="mt-1 text-xs text-[#777064]">Showing {products.length} of {total} objects</p>
                </div>
                <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full border border-[#e6ddcc] px-3 py-1.5 text-sm">Close</button>
              </div>
              <form onSubmit={applyFilters} className="grid gap-5 py-5">
                <label className="grid gap-2 text-sm">
                  Category
                  <select value={filterDraft.category} onChange={(event) => setFilterDraft((draft) => ({ ...draft, category: event.target.value }))} className="rounded-lg border border-[#e6ddcc] bg-white px-3 py-3">
                    <option value="">All categories</option>
                    {categories.filter((item) => item.active).map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
                  </select>
                </label>
                <fieldset className="grid gap-2">
                  <legend className="text-sm">Price range (₹)</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-xs text-[#777064]">Minimum
                      <input type="number" min="0" step="1" inputMode="numeric" value={filterDraft.minPrice} onChange={(event) => setFilterDraft((draft) => ({ ...draft, minPrice: event.target.value }))} className="rounded-lg border border-[#e6ddcc] bg-white px-3 py-3 text-sm text-[#191919]" />
                    </label>
                    <label className="grid gap-1 text-xs text-[#777064]">Maximum
                      <input type="number" min="0" step="1" inputMode="numeric" value={filterDraft.maxPrice} onChange={(event) => setFilterDraft((draft) => ({ ...draft, maxPrice: event.target.value }))} className="rounded-lg border border-[#e6ddcc] bg-white px-3 py-3 text-sm text-[#191919]" />
                    </label>
                  </div>
                </fieldset>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={filterDraft.inStock} onChange={(event) => setFilterDraft((draft) => ({ ...draft, inStock: event.target.checked }))} className="size-4 accent-[#6f4e37]" />
                  Available now
                </label>
                <label className="grid gap-2 text-sm">
                  Sort by
                  <select value={filterDraft.sort} onChange={(event) => setFilterDraft((draft) => ({ ...draft, sort: event.target.value }))} className="rounded-lg border border-[#e6ddcc] bg-white px-3 py-3">
                    <option value="featured">Featured</option>
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </select>
                </label>
                {filterDraft.minPrice && filterDraft.maxPrice && Number(filterDraft.minPrice) > Number(filterDraft.maxPrice) && (
                  <p role="alert" className="text-sm text-[#a34d4d]">Minimum price cannot exceed maximum price.</p>
                )}
                <div className="sticky bottom-0 flex gap-3 border-t border-[#e6ddcc] bg-[#fffcf5] pt-4">
                  <button type="button" onClick={resetFilters} className="flex-1 rounded-full border border-[#d8cbb8] px-4 py-3 text-sm text-[#493323]">Reset</button>
                  <button type="submit" disabled={Boolean(filterDraft.minPrice && filterDraft.maxPrice && Number(filterDraft.minPrice) > Number(filterDraft.maxPrice))} className="flex-1 rounded-full bg-[#493323] px-4 py-3 text-sm text-white disabled:opacity-50">Apply filters</button>
                </div>
              </form>
            </section>
          </div>
        )}
        {error ? (
          <p role="alert" className="py-16 text-center text-sm text-[#a34d4d]">{statusMessage}</p>
        ) : loading ? (
          <p role="status" className="py-16 text-center text-sm text-[#777064]">{statusMessage}</p>
        ) : products.length > 0 ? (
          <>
            <ProductGrid products={products} />
            {pages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-5 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => changeParameter("page", String(page - 1))}
                  className="rounded-full border border-[#e6ddcc] px-4 py-2 disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {page} of {pages}</span>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => changeParameter("page", String(page + 1))}
                  className="rounded-full border border-[#e6ddcc] px-4 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="py-16 text-center text-sm text-[#777064]">{statusMessage}</p>
        )}
      </section>
    </main>
  );
}
