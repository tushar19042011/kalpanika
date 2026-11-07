"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useCategoryData } from "@/components/category-data-provider";
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { formatPrice } from "@/lib/products";

type CartLine = { slug: string; quantity: number };
type StorefrontContextValue = {
  addToBag: (slug: string) => Promise<boolean>;
  updateQuantity: (slug: string, quantity: number) => Promise<void>;
  removeFromBag: (slug: string) => Promise<void>;
  clearCart: () => Promise<boolean>;
  items: CartLine[];
  count: number;
  subtotal: number;
  cartReady: boolean;
  cartError: string;
  openCart: () => void;
  wishlistIds: string[];
  wishlistReady: boolean;
  wishlistError: string;
  toggleWishlist: (slug: string) => Promise<void>;
  removeFromWishlist: (slug: string) => void;
};

const StorefrontContext = createContext<StorefrontContextValue>({
  addToBag: async () => false,
  updateQuantity: async () => {},
  removeFromBag: async () => {},
  clearCart: async () => false,
  items: [],
  count: 0,
  subtotal: 0,
  cartReady: false,
  cartError: "",
  openCart: () => {},
  wishlistIds: [],
  wishlistReady: false,
  wishlistError: "",
  toggleWishlist: async () => {},
  removeFromWishlist: () => {},
});
export const useCart = () => useContext(StorefrontContext);
export const useWishlist = () => useContext(StorefrontContext);

function readCartCookie(): CartLine[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith("kalpanika_cart="));
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match.split("=")[1]));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine =>
      typeof item === "object" && item !== null
      && "slug" in item && typeof item.slug === "string"
      && "quantity" in item && typeof item.quantity === "number"
      && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20,
    )
  } catch {
    return [];
  }
}

const WISHLIST_STORAGE_KEY = "kalpanika_wishlist";
const CART_MERGE_ID_KEY = "kalpanika_cart_merge_id";

function guestCartMergeId() {
  try {
    const stored = window.localStorage.getItem(CART_MERGE_ID_KEY);
    if (stored) return stored;
    const mergeId = window.crypto.randomUUID();
    window.localStorage.setItem(CART_MERGE_ID_KEY, mergeId);
    return mergeId;
  } catch {
    return window.crypto.randomUUID();
  }
}

function clearGuestCart() {
  document.cookie = "kalpanika_cart=; path=/; max-age=0; samesite=lax";
  try {
    window.localStorage.removeItem(CART_MERGE_ID_KEY);
  } catch (error) {
    console.error("Unable to clear the guest cart merge token.", error);
  }
}

function readWishlist(): string[] {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
  } catch (error) {
    console.error("Unable to read the wishlist from local storage.", error);
    return [];
  }
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn("Ignoring invalid wishlist data in local storage.");
      return [];
    }
    return [...new Set(parsed.filter(
      (slug): slug is string =>
        typeof slug === "string" && /^[a-z0-9-]{1,140}$/.test(slug),
    ))];
  } catch (error) {
    console.warn("Ignoring corrupted wishlist data in local storage.", error);
    return [];
  }
}

export function StorefrontShell({
  children,
  active,
  onSearchClick,
}: {
  children: React.ReactNode;
  active?: "category" | "products" | "story";
  onSearchClick?: () => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { products: catalogProducts, ready: catalogReady, error: catalogError } = useCategoryData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [items, setItems] = useState<CartLine[]>([]);
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [cartError, setCartError] = useState("");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistOwnerId, setWishlistOwnerId] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState("");

  useEffect(() => {
    if (cartOwnerId === "guest") {
      document.cookie = `kalpanika_cart=${encodeURIComponent(JSON.stringify(items))}; path=/; max-age=2592000; samesite=lax`;
    }
  }, [cartOwnerId, items]);
  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setWishlistOwnerId(null);
    setWishlistIds([]);
    setWishlistError("");
    if (!isSignedIn || !user?.id) {
      setWishlistIds(readWishlist());
      setWishlistOwnerId("guest");
      return () => { cancelled = true; };
    }

    const loadWishlist = async () => {
      try {
        const guestSlugs = readWishlist();
        let response = await fetch("/api/account/wishlist", { cache: "no-store" });
        let data = await response.json() as { slugs?: string[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load your wishlist.");

        if (guestSlugs.length) {
          response = await fetch("/api/account/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "merge", slugs: guestSlugs, expectedUserId: user.id }),
          });
          const mergeData = await response.json() as { error?: string };
          if (!response.ok) throw new Error(mergeData.error ?? "Unable to merge your guest wishlist.");
          window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
          response = await fetch("/api/account/wishlist", { cache: "no-store" });
          data = await response.json() as { slugs?: string[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? "Unable to refresh your wishlist.");
        }

        if (!cancelled) {
          setWishlistIds(Array.isArray(data.slugs) ? data.slugs : []);
          setWishlistOwnerId(user.id);
        }
      } catch (error) {
        if (!cancelled) {
          setWishlistError(error instanceof Error ? error.message : "Unable to load your wishlist.");
          setWishlistOwnerId(user.id);
          console.error("Unable to load the signed-in wishlist.", error);
        }
      }
    };
    void loadWishlist();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user?.id]);
  useEffect(() => {
    if (wishlistOwnerId !== "guest") return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch (error) {
      console.error("Unable to save the wishlist to local storage.", error);
    }
  }, [wishlistIds, wishlistOwnerId]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setCartOwnerId(null);
    setItems([]);
    setCartError("");
    if (!isSignedIn || !user?.id) {
      setItems(readCartCookie());
      setCartOwnerId("guest");
      return () => { cancelled = true; };
    }

    const loadCart = async () => {
      try {
        const guestItems = readCartCookie();
        let response = await fetch("/api/account/cart", { cache: "no-store" });
        let data = await response.json() as { items?: CartLine[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load your cart.");

        if (guestItems.length) {
          response = await fetch("/api/account/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "merge", items: guestItems, mergeId: guestCartMergeId(), expectedUserId: user.id }),
          });
          data = await response.json() as { items?: CartLine[]; error?: string };
          if (!response.ok) throw new Error(data.error ?? "Unable to merge your guest cart.");
          clearGuestCart();
        }

        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setCartOwnerId(user.id);
        }
      } catch (error) {
        if (!cancelled) {
          setCartError(error instanceof Error ? error.message : "Unable to load your cart.");
          setCartOwnerId(user.id);
          console.error("Unable to load the signed-in cart.", error);
        }
      }
    };
    void loadCart();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    if (cartOwnerId !== "guest" || !catalogReady || catalogError) return;
    setItems((current) => current.filter((item) =>
      catalogProducts.some((product) => product.slug === item.slug && product.active !== false && (product.stock ?? 0) > 0),
    ))
  }, [cartOwnerId, catalogProducts, catalogReady, catalogError]);
  const getCatalogProduct = (slug: string) => catalogProducts.find((product) => product.slug === slug);
  const cartOwner = isSignedIn ? user?.id ?? null : "guest";
  const cartReady = Boolean(cartOwner && cartOwnerId === cartOwner);
  const wishlistOwner = isSignedIn ? user?.id ?? null : "guest";
  const wishlistReady = Boolean(wishlistOwner && wishlistOwnerId === wishlistOwner);
  const visibleItems = cartReady ? items : [];
  const visibleWishlistIds = wishlistReady ? wishlistIds : [];

  const requestCart = async (body: Record<string, unknown>) => {
    const expectedUserId = user?.id;
    try {
      const response = await fetch("/api/account/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, expectedUserId }),
      });
      const data = await response.json() as { items?: CartLine[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update your cart.");
      if (user?.id === expectedUserId && Array.isArray(data.items)) {
        setItems(data.items);
        setCartError("");
      }
      return true;
    } catch (error) {
      setCartError(error instanceof Error ? error.message : "Unable to update your cart.");
      console.error("Unable to update the signed-in cart.", error);
      return false;
    }
  };

  const addToBag = async (slug: string) => {
    const product = getCatalogProduct(slug);
    if (!cartReady || !product?.id || product.active === false || !product.stock || product.stock < 1) return false;
    if (isSignedIn) return requestCart({ action: "add", productId: product.id });
    if (cartOwnerId !== "guest") return false;
    const line = visibleItems.find((item) => item.slug === slug);
    const quantity = (line?.quantity ?? 0) + 1;
    if (quantity > Math.min(20, product.stock)) return false;
    setItems((current) => line
      ? current.map((item) => item.slug === slug ? { ...item, quantity } : item)
      : [...current, { slug, quantity: 1 }]);
    return true;
  };

  const updateQuantity = async (slug: string, quantity: number) => {
    const product = getCatalogProduct(slug);
    if (!cartReady || !product?.id) return;
    if (isSignedIn) {
      await requestCart({ action: "set", productId: product.id, quantity });
      return;
    }
    setItems((current) =>
      quantity > 0
        ? current.map((item) =>
            item.slug === slug
              ? { ...item, quantity: Math.min(quantity, getCatalogProduct(slug)?.stock ?? quantity, 20) }
              : item,
          )
        : current.filter((item) => item.slug !== slug),
    );
  };

  const removeFromBag = async (slug: string) => {
    const product = getCatalogProduct(slug);
    if (!cartReady || !product?.id) return;
    if (isSignedIn) {
      await requestCart({ action: "remove", productId: product.id });
      return;
    }
    setItems((current) => current.filter((item) => item.slug !== slug));
  };

  const clearCart = async () => {
    if (!cartReady) return false;
    if (isSignedIn) return requestCart({ action: "clear" });
    setItems([]);
    return true;
  };

  const toggleWishlist = async (slug: string) => {
    if (!wishlistReady) return;
    const action = visibleWishlistIds.includes(slug) ? "remove" : "add";
    setWishlistError("");
    if (!isSignedIn) {
      setWishlistIds(action === "remove"
        ? visibleWishlistIds.filter((item) => item !== slug)
        : [...visibleWishlistIds, slug]);
      return;
    }
    try {
      const response = await fetch("/api/account/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action, expectedUserId: user?.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update your wishlist.");
      if (user?.id === wishlistOwnerId) {
        setWishlistIds(action === "remove"
          ? visibleWishlistIds.filter((item) => item !== slug)
          : [...visibleWishlistIds, slug]);
      }
    } catch (error) {
      setWishlistError(error instanceof Error ? error.message : "Unable to update your wishlist.");
      console.error("Unable to update the signed-in wishlist.", error);
    }
  };
  const removeFromWishlist = (slug: string) => {
    if (visibleWishlistIds.includes(slug)) void toggleWishlist(slug);
  };
  const count = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = visibleItems.reduce(
    (sum, item) => sum + (getCatalogProduct(item.slug)?.price ?? 0) * item.quantity,
    0,
  );
  const value = useMemo(
    () => ({
      addToBag,
      updateQuantity,
      removeFromBag,
      clearCart,
      items: visibleItems,
      count,
      subtotal,
      cartReady,
      cartError,
      openCart: () => setCartOpen(true),
      wishlistIds: visibleWishlistIds,
      wishlistReady,
      wishlistError,
      toggleWishlist,
      removeFromWishlist,
    }),
    [visibleItems, count, subtotal, cartReady, cartError, visibleWishlistIds, wishlistReady, wishlistError, catalogProducts, isSignedIn],
  );

  return (
    <StorefrontContext.Provider value={value}>
      <div className="min-h-screen bg-[#fffcf5] text-[#191919]">
        <header className="sticky top-0 z-40 border-b border-[#e6ddcc]/80 bg-[#fffcf5]/90 backdrop-blur-md">
          <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 md:h-[76px] md:px-10">
            <Link
              href="/"
              aria-label="Kalpanika home"
              className="flex items-center gap-2.5 text-[#6f4e37]"
            >
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kalpanika-aSSKdYSGeA92HvyWlr3hZg3AIDVPfT.png"
                alt="Kalpanika logo"
                width="76"
                height="76"
                loading="eager"
                referrerPolicy="no-referrer"
                className="h-[76px] w-[76px] shrink-0 bg-white object-contain"
              />
            </Link>
            <nav
              aria-label="Primary navigation"
              className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 text-sm md:flex"
            >
              <Link href="/" className="hover:text-[#6f4e37]">
                Home
              </Link>
              <Link
                href="/products"
                className={
                  active === "products"
                    ? "font-medium text-[#6f4e37]"
                    : "hover:text-[#6f4e37]"
                }
              >
                Products
              </Link>
              <Link
                href="/category"
                className={
                  active === "category"
                    ? "font-medium text-[#6f4e37]"
                    : "hover:text-[#6f4e37]"
                }
              >
                Categories
              </Link>
              
              <Link
                href="/our-story"
                className={
                  active === "story"
                    ? "font-medium text-[#6f4e37]"
                    : "hover:text-[#6f4e37]"
                }
              >
                Our Story
              </Link>
            </nav>
            <div className="flex items-center gap-1">
              {onSearchClick ? (
                <button aria-label="Search" onClick={onSearchClick} className="icon-button">
                  <Search />
                </button>
              ) : (
                <Link href="/products" aria-label="Search" className="icon-button">
                  <Search />
                </Link>
              )}
              <Link
                href="/wishlist"
                aria-label="Wishlist"
                className="icon-button relative"
              >
                <Heart />
                {visibleWishlistIds.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#6f4e37] text-[9px] text-white">
                    {visibleWishlistIds.length}
                  </span>
                )}
              </Link>
              <Link
                href="/account"
                aria-label="Account"
                className="icon-button"
              >
                <UserRound />
              </Link>
              <button
                aria-label={`Shopping bag, ${count} items`}
                onClick={() => setCartOpen(true)}
                className="icon-button relative"
              >
                <ShoppingBag />
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#6f4e37] text-[9px] text-white">
                    {count}
                  </span>
                )}
              </button>
              <div className="md:hidden">
                <button
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="icon-button"
                >
                  {menuOpen ? <X /> : <Menu />}
                </button>
              </div>
            </div>
          </div>
          {/* yo kalpanika this is tushar and i am here to code  */}
          {menuOpen && (
            <div className="border-t border-[#e6ddcc] px-5 py-5 md:hidden">
              <div className="flex flex-col gap-4 text-sm">
                <Link href="/" onClick={() => setMenuOpen(false)}>
                  Home
                </Link>
                <Link href="/products" onClick={() => setMenuOpen(false)}>
                  Products
                </Link>
                <Link href="/category" onClick={() => setMenuOpen(false)}>
                  Categories
                </Link>
                <Link href="/our-story" onClick={() => setMenuOpen(false)}>
                  Our Story
                </Link>
                <Link
                  href="/wishlist"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between"
                >
                  <span>Wishlist</span>
                  {visibleWishlistIds.length > 0 && (
                    <span className="text-xs text-[#6f4e37]">
                      {visibleWishlistIds.length}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          )}
        </header>
        {children}
        <footer className="border-t border-[#e6ddcc] bg-[#fffcf5] px-5 py-10 md:px-10">
          <div className="mx-auto grid max-w-[1440px] gap-8 sm:grid-cols-2 lg:grid-cols-[1.25fr_repeat(3,0.8fr)]">
            <div>
              <Link
                href="/"
                className="font-semibold tracking-[0.22em] text-[#6f4e37]"
              >
                KALPANIKA
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-6 text-[#777064]">
                Thoughtful objects, made layer by layer for curious spaces.
              </p>
            </div>
            <div>
              <p className="eyebrow">Information</p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <Link href="/shipping-returns" className="hover:text-[#493323]">Shipping &amp; returns</Link>
                <Link href="/care-guide" className="hover:text-[#493323]">Care guide</Link>
                <Link href="/faqs" className="hover:text-[#493323]">FAQs</Link>
                <Link href="/contact" className="hover:text-[#493323]">Contact</Link>
              </div>
            </div>
            <div>
              <p className="eyebrow">Legal</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-[#777064]">
                <Link href="/privacy-policy" className="hover:text-[#493323]">Privacy policy</Link>
                <Link href="/terms-and-conditions" className="hover:text-[#493323]">Terms &amp; conditions</Link>
              </div>
            </div>
            <div>
              <p className="eyebrow">Store</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-[#777064]">
                <Link href="/products" className="hover:text-[#493323]">All objects</Link>
                <Link href="/category" className="hover:text-[#493323]">Categories</Link>
                <Link href="/our-story" className="hover:text-[#493323]">Our story</Link>
                <Link href="/account" className="hover:text-[#493323]">My account</Link>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-12 flex max-w-[1440px] justify-between border-t border-[#e6ddcc] pt-5 text-xs text-[#777064]">
            <span>© 2026 Kalpanika</span>
            <span className="flex gap-4">
              <Link href="/privacy-policy" className="hover:text-[#493323]">Privacy</Link>
              <Link href="/terms-and-conditions" className="hover:text-[#493323]">Terms</Link>
            </span>
          </div>
        </footer>
        {cartOpen && (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="Close cart"
              className="absolute inset-0 bg-[#493323]/25"
              onClick={() => setCartOpen(false)}
            />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#fffcf5] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#e6ddcc] pb-5">
                <div>
                  <p className="eyebrow">Your bag</p>
                  <h2 className="mt-1 text-2xl font-medium">
                    {count} {count === 1 ? "object" : "objects"}
                  </h2>
                </div>
                <button
                  aria-label="Close cart"
                  className="icon-button"
                  onClick={() => setCartOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-5">
                {cartError && <p role="alert" className="mb-4 rounded-lg bg-[#fbeaea] p-3 text-sm text-[#a34d4d]">{cartError}</p>}
                {!cartReady ? (
                  <p role="status" className="py-8 text-center text-sm text-[#777064]">Loading your bag…</p>
                ) : visibleItems.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <ShoppingBag className="mb-4 text-[#d8c47a]" />
                    <p className="font-medium">Your bag is waiting.</p>
                    <p className="mt-2 text-sm text-[#777064]">
                      Add something thoughtful to get started.
                    </p>
                    <Link
                      href="/products"
                      onClick={() => setCartOpen(false)}
                      className="mt-6 rounded-full bg-[#6f4e37] px-5 py-3 text-sm text-white"
                    >
                      Browse objects
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {visibleItems.map((item) => {
                      const product = catalogProducts.find((entry) => entry.slug === item.slug);
                      if (!product) return null;
                      return (
                        <div className="flex gap-4" key={item.slug}>
                          <div
                            className={`product-art ${product.imageClass} size-20 shrink-0`}
                          >
                            {product.imageUrl && <img src={product.imageUrl} alt="" className="size-full rounded-lg object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-3">
                              <div>
                                <p className="truncate text-sm font-medium">
                                  {product.name}
                                </p>
                                <p className="mt-1 text-sm text-[#777064]">
                                  {formatPrice(product.price)}
                                </p>
                              </div>
                              <button
                                aria-label={`Remove ${product.name}`}
                                className="text-[#777064]"
                                onClick={() => removeFromBag(item.slug)}
                              >
                                <Trash2 />
                              </button>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <button
                                aria-label={`Decrease ${product.name}`}
                                className="rounded-full border border-[#e6ddcc] p-1"
                                onClick={() =>
                                  updateQuantity(item.slug, item.quantity - 1)
                                }
                              >
                                <Minus />
                              </button>
                              <span className="min-w-4 text-center text-sm">
                                {item.quantity}
                              </span>
                              <button
                                aria-label={`Increase ${product.name}`}
                                disabled={item.quantity >= Math.min(product.stock ?? 0, 20)}
                                className="rounded-full border border-[#e6ddcc] p-1"
                                onClick={() =>
                                  updateQuantity(item.slug, item.quantity + 1)
                                }
                              >
                                <Plus />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {visibleItems.length > 0 && (
                <div className="border-t border-[#e6ddcc] pt-5">
                  <div className="flex justify-between text-base">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#777064]">
                    Shipping and taxes calculated at checkout.
                  </p>
                  <Link
                    href="/checkout"
                    onClick={() => setCartOpen(false)}
                    className="mt-5 block rounded-full bg-[#6f4e37] px-5 py-3.5 text-center text-sm text-white"
                  >
                    Checkout
                  </Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </StorefrontContext.Provider>
  );
}
