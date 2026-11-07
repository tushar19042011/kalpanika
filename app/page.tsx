"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Search, Sparkles, X } from "lucide-react";
import { ProductGrid } from "@/components/product-grid";
import { NewsletterForm } from "@/components/newsletter-form";
import { StorefrontShell } from "@/components/storefront-shell";
import { useCategoryData } from "@/components/category-data-provider";
import type { Product } from "@/lib/products";

const featuredProductBackgrounds = [
  "bg-[#eadfc8]",
  "bg-[#e4d8c9]",
  "bg-[#eee4bf]",
  "bg-[#e8d2bd]",
];
function ProductShape({ index }: { index: number }) {
  return (
    <div aria-hidden="true" className={`product-shape shape-${index}`}>
      <span />
    </div>
  );
}

export default function Page() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <StorefrontShell onSearchClick={() => setSearchOpen(true)}>
      <HomePageContent searchOpen={searchOpen} setSearchOpen={setSearchOpen} />
    </StorefrontShell>
  );
}

function HomePageContent({
  searchOpen,
  setSearchOpen,
}: {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}) {
  const { categories, products, error, ready } = useCategoryData();
  const featuredProducts = products.filter((product) => product.featured).slice(0, 4);
  const prioritizedCategories = categories
    .filter((category) => category.active)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (!searchOpen || !term) {
      setResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/catalog?q=${encodeURIComponent(term)}&limit=8`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json() as { products?: Product[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Search is temporarily unavailable.");
        if (!controller.signal.aborted) setResults(Array.isArray(data.products) ? data.products : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, searchOpen]);

  return (
    <main className="min-h-screen bg-[#fffcf5] text-[#191919]">
      <section
        id="top"
        className="mx-auto grid max-w-[1440px] items-center gap-8 px-5 py-8 sm:py-10 md:grid-cols-[0.82fr_1.18fr] md:gap-10 md:px-10 md:py-11"
      >
        <div className="max-w-xl animate-in-up">
          <p className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#6f4e37]">
            <Sparkles className="size-4" /> Objects for curious spaces
          </p>
          <h1 className="max-w-lg text-[2.95rem] font-medium leading-[0.98] tracking-[-0.06em] sm:text-[3.25rem] md:text-[clamp(3.35rem,4.7vw,5rem)]">
            Ideas
            <br />
            <em className="font-serif font-normal">take shape.</em>
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-5 sm:mt-5 sm:text-sm sm:leading-6 text-[#777064]">
            Thoughtfully designed objects, transformed from digital imagination
            into things you can hold.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 sm:mt-6">
            <Link href="/products" className="button-primary">
              Explore products <ArrowUpRight />
            </Link>
            <Link href="/our-story" className="button-secondary">
              Our story
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[#e6ddcc] pt-5 text-xs text-[#777064]">
            <span>
              <strong className="block text-lg font-medium text-[#191919]">
                01
              </strong>
              Sculptural forms
            </span>
            <span>
              <strong className="block text-lg font-medium text-[#191919]">
                02
              </strong>
              Everyday objects
            </span>
            <span>
              <strong className="block text-lg font-medium text-[#191919]">
                03
              </strong>
              Objects for your space
            </span>
          </div>
        </div>
        <div className="  justify-self-center animate-in-up animation-delay-150 md:w-[88%] md:justify-self-end">
          <div className="absolute left-3 top-4 z-10 rounded-full sm:-left-5 sm:top-10 bg-[#f1e6a8] px-5 py-3 text-xs uppercase tracking-[0.14em] text-[#493323] shadow-sm">
            Small batch / big ideas
          </div>
          <div className="relative aspect-[1.5] overflow-hidden rounded-[2px] bg-[#e9ddc5] sm:aspect-[1.3] md:aspect-[1.28]">
            <Image
              src="/kalpanika-hero.png"
              alt="Sculptural 3D-printed objects from Kalpanika"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 92vw, 48vw"
            />
          </div>
          <div className="absolute -bottom-5 -right-3 bg-[#493323] px-5 py-4 text-xs leading-5 text-[#fffcf5]">
            Digital thought,
            <br />
            <span className="text-[#f1e6a8]">physical form.</span>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e6ddcc] bg-[#f7f1e3] px-5 py-14 sm:py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Explore the collection</p>
              <h2 className="section-heading">Made for your world.</h2>
            </div>
            <Link
              href="/category"
              className="w-fit text-sm text-[#6f4e37] underline underline-offset-4"
            >
              See All Categories <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="grid gap-3 md:h-[500px] md:grid-cols-[1.2fr_0.8fr] md:grid-rows-2">
            {prioritizedCategories.map((category, index) => (
              <Link
                key={category.slug}
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                className={
                  index === 0
                    ? "category-tile min-h-[300px] bg-[#e9ddc5] md:row-span-2 md:min-h-0"
                    : `category-tile min-h-[190px] ${index === 1 ? "bg-[#ded6cc]" : "bg-[#eee6c8]"} md:min-h-0`
                }
              >
                <ProductShape index={index + 2} />
                <div className="relative z-10 mt-auto">
                  <p className={index === 0 ? "text-xl" : "text-lg"}>
                    {category.name}
                  </p>
                  <p className="mt-1 text-xs text-[#777064]">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "object" : "objects"} /{" "}
                    {category.description}
                  </p>
                </div>
                <ArrowUpRight className="absolute right-5 top-5 z-10 size-5 opacity-60" />
              </Link>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#a34d4d]">{error}</p>}
          {ready && !error && prioritizedCategories.length === 0 && (
            <p className="mt-4 text-sm text-[#777064]">Categories will appear here as they are added.</p>
          )}
        </div>
      </section>

      <section
        id="products"
        className="mx-auto max-w-[1440px] px-5 py-24 md:px-10"
      >
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="eyebrow">The edit / 01</p>
            <h2 className="section-heading">Objects worth keeping.</h2>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 text-sm text-[#777064] sm:flex"
          >
            <Search className="size-4" /> Search collection
          </button>
        </div>
        <ProductGrid
          products={featuredProducts}
          className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-5"
          imageBackgrounds={featuredProductBackgrounds}
          openCartOnAdd
        />
        {error && <p role="alert" className="mt-6 text-sm text-[#a34d4d]">{error}</p>}
        {ready && !error && featuredProducts.length === 0 && (
          <p className="py-10 text-center text-sm text-[#777064]">Featured products will appear here when available.</p>
        )}
      </section>

      <section className="bg-[#493323] px-5 py-24 text-[#fffcf5] md:px-10">
        <div className="mx-auto grid max-w-[1440px] items-center gap-14 md:grid-cols-2">
          <div>
            <p className="eyebrow text-[#d8c47a]">The making process</p>
            <h2 className="max-w-lg text-4xl font-medium leading-tight tracking-[-0.04em] md:text-6xl">
              From digital imagination to physical form.
            </h2>
            <p className="mt-6 max-w-md leading-7 text-[#d9d0c4]">
              Every layer brings an idea closer to reality. We make objects that
              invite a second look, and a place in your everyday.
            </p>
            <Link
              href="/our-story"
              className="mt-8 inline-flex items-center gap-2 border-b border-[#d8c47a] pb-2 text-sm text-[#f1e6a8]"
            >
              See how we make <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 items-start gap-2">
            <div className="process-cell relative h-56 overflow-hidden bg-[#c7af8c]">
              <Image
                src="/process-imagine.png"
                alt="Digital forms ready to become physical objects"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 30vw, 18vw"
              />
              <span>01</span>
              <small>Imagine</small>
            </div>
            <div className="process-cell relative mt-8 h-56 overflow-hidden bg-[#e0d0ad]">
              <Image
                src="/process-layer.png"
                alt="Close-up of a 3D printer building an object layer by layer"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 30vw, 18vw"
              />
              <span>02</span>
              <small>Layer</small>
            </div>
            <div className="process-cell relative mt-16 h-56 overflow-hidden bg-[#b78665]">
              <Image
                src="/process-keep.png"
                alt="Finished sculptural object on a warm plinth"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 30vw, 18vw"
              />
              <span>03</span>
              <small>Keep</small>
            </div>
          </div>
        </div>
      </section>

      <section
        id="story"
        className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 md:grid-cols-[1fr_1fr] md:px-10 md:py-32"
      >
        <div>
          <p className="eyebrow">A little about us</p>
          <h2 className="section-heading max-w-xl">
            Good design turns ordinary spaces into something personal.
          </h2>
        </div>
        <div className="flex flex-col justify-end">
          <p className="max-w-md leading-7 text-[#777064]">
            Kalpanika is a small design practice exploring what happens when
            digital tools meet a human hand. We create considered, tactile
            objects for the places where life happens.
          </p>
          <Link
            href="/our-story"
            className="mt-8 flex w-fit items-center gap-2 text-sm text-[#6f4e37] underline underline-offset-4"
          >
            Read our story <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-[#e6ddcc] bg-[#f1e6a8] px-5 py-16 md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="eyebrow text-[#6f4e37]">
              New things, now and then
            </p>
            <h2 className="mt-2 text-3xl tracking-[-0.04em]">
              Be the first to see what&apos;s new.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#493323]/80">
              Get an email when a new Kalpanika product arrives. Confirm your email to subscribe; unsubscribe anytime.
            </p>
            <Link href="/privacy-policy" className="mt-2 inline-block text-xs text-[#493323] underline underline-offset-4">
              Read our privacy policy
            </Link>
          </div>
          <NewsletterForm
            id="home-newsletter-email"
            className="w-full max-w-md"
            labelClassName="flex w-full border-b border-[#6f4e37] pb-2"
            inputClassName="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#6f4e37]/70"
            buttonClassName="text-sm font-medium text-[#493323] disabled:opacity-60"
          />
        </div>
      </section>

      {searchOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fffcf5] p-5 md:p-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between">
              <p className="font-semibold tracking-[0.22em] text-[#6f4e37]">
                SEARCH
              </p>
              <button
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="icon-button"
              >
                <X />
              </button>
            </div>
            <div className="mt-20 flex items-center gap-4 border-b border-[#493323] pb-4">
              <Search className="size-5" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search objects or categories"
                className="flex-1 bg-transparent text-2xl outline-none placeholder:text-[#777064]/60"
              />
            </div>
            <div className="mt-10 grid gap-4">
              {searchError ? (
                <p role="alert" className="text-[#a34d4d]">{searchError}</p>
              ) : searchLoading ? (
                <p role="status" className="text-sm text-[#777064]">Searching the collection…</p>
              ) : !query.trim() && error ? (
                <p role="alert" className="text-sm text-[#a34d4d]">{error}</p>
              ) : !query.trim() && !ready ? (
                <p role="status" className="text-sm text-[#777064]">Loading featured objects…</p>
              ) : query.trim() && results.length === 0 ? (
                <p className="text-[#777064]">
                  No objects found for “{query}”.
                </p>
              ) : !query.trim() && featuredProducts.length === 0 ? (
                <p className="text-sm text-[#777064]">Start typing to search the collection.</p>
              ) : (
                (query.trim() ? results : featuredProducts.slice(0, 3)).map((product) => (
                  <Link
                    key={product.slug}
                    href={`/products/${product.slug}`}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between border-b border-[#e6ddcc] py-4 text-left hover:text-[#6f4e37]"
                  >
                    <span>
                      {product.name}
                      <small className="ml-3 text-xs text-[#777064]">
                        {product.category}
                      </small>
                    </span>
                    <span>₹{product.price.toLocaleString("en-IN")}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
