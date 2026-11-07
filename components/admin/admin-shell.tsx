"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { Bell, BarChart3, Check, ChevronLeft, ChevronRight, ExternalLink, LayoutDashboard, Mail, Menu, MessageSquareText, Package, Search, Settings, ShoppingCart, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdminDataProvider } from "@/components/admin/admin-data-provider"

type AdminNotification = {
  id: string
  title: string
  detail: string
  time: string
  unread: boolean
}

const groups = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Store management", items: [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/categories", label: "Categories", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/customers", label: "Customers", icon: LayoutDashboard },
    { href: "/admin/support", label: "Support", icon: MessageSquareText },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
    { href: "/admin/inventory", label: "Inventory", icon: Package },
  ]},
  { label: "Insights", items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3 }] },
  { label: "System", items: [{ href: "/admin/settings", label: "Settings", icon: Settings }] },
]

type SearchRecord = { id: string; name: string; detail?: string }
type AdminSearchResults = {
  products: SearchRecord[]
  categories: SearchRecord[]
  orders: SearchRecord[]
  customers: SearchRecord[]
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<AdminSearchResults | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const current = groups.flatMap((group) => group.items).find((item) => item.href === pathname)
  const unreadCount = notifications.filter((notification) => notification.unread).length
  const profileName = user?.fullName || user?.username || "Admin profile"
  const initials = profileName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (!notificationsOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [notificationsOpen])

  const markNotificationRead = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, unread: false } : notification,
      ),
    )
  }

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      setSearchResults(null)
      setSearchError("")
      setSearchLoading(false)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchError("")
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json() as AdminSearchResults & { error?: string }
        if (!response.ok) throw new Error(data.error ?? "Admin search is temporarily unavailable.")
        if (!controller.signal.aborted) setSearchResults(data)
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults(null)
          setSearchError(error instanceof Error ? error.message : "Admin search is temporarily unavailable.")
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchQuery])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  const searchGroups = searchResults ? [
    { label: "Products", items: searchResults.products, href: (item: SearchRecord) => `/admin/products/${encodeURIComponent(item.id)}/edit`, detail: (item: SearchRecord) => item.detail ?? "" },
    { label: "Categories", items: searchResults.categories, href: (_item: SearchRecord) => "/admin/categories", detail: (item: SearchRecord) => item.detail ?? "" },
    { label: "Orders", items: searchResults.orders, href: (item: SearchRecord) => `/admin/orders/${encodeURIComponent(item.id)}`, detail: (item: SearchRecord) => item.detail ?? "" },
    { label: "Customers", items: searchResults.customers, href: (item: SearchRecord) => `/admin/customers/${encodeURIComponent(item.id)}`, detail: (item: SearchRecord) => item.detail ?? "" },
  ] : []
  const hasSearchResults = searchGroups.some((group) => group.items.length > 0)

  return (
    <AdminDataProvider>
    <div className="min-h-screen bg-[#f8f8f6] text-[#191919]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-[#e8e6e0] bg-white transition-all lg:flex lg:flex-col", collapsed ? "w-[76px]" : "w-[248px]") }>
        <SidebarContent collapsed={collapsed} pathname={pathname} />
        <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 flex size-6 items-center justify-center rounded-full border border-[#e8e6e0] bg-white text-[#777] shadow-sm hover:text-[#191919]">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white shadow-xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <button aria-label="Close menu" className="absolute right-4 top-4 text-[#777]" onClick={() => setMobileOpen(false)}><X /></button>
        <SidebarContent pathname={pathname} />
      </aside>
      <div className={cn("transition-[padding]", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]") }>
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e8e6e0] bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button className="rounded-lg p-2 text-[#777] hover:bg-[#f7f6f2] lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
            <div><p className="text-sm font-semibold">{current?.label ?? (pathname === "/admin/profile" ? "Profile" : "Dashboard")}</p><p className="hidden text-xs text-[#777] sm:block">Kalpanika / Admin</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative w-[min(42vw,15rem)] sm:w-56">
              <label className="flex items-center gap-2 rounded-lg border border-[#e8e6e0] bg-white px-2.5 text-xs text-[#777] sm:px-3">
                <Search className="size-4 shrink-0" />
                <input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search anything" aria-label="Search admin records" className="min-w-0 flex-1 bg-transparent py-2.5 text-[#191919] outline-none placeholder:text-[#999]" />
                <kbd className="hidden rounded bg-[#f3f1ec] px-1.5 py-0.5 text-[10px] text-[#999] lg:inline">⌘ K</kbd>
              </label>
              {searchQuery.trim() && <div role="listbox" aria-label="Admin search results" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(70vh,32rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[#e8e6e0] bg-white p-2 shadow-xl">
                {searchLoading ? <p role="status" className="px-3 py-5 text-center text-sm text-[#777]">Searching records…</p>
                  : searchError ? <p role="alert" className="px-3 py-5 text-center text-sm text-[#a34d4d]">{searchError}</p>
                    : !hasSearchResults ? <p className="px-3 py-5 text-center text-sm text-[#777]">No matching records.</p>
                      : searchGroups.filter((group) => group.items.length > 0).map((group) => <section key={group.label} className="pb-2 last:pb-0">
                        <h2 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a97b4c]">{group.label}</h2>
                        {group.items.map((item) => <button key={`${group.label}-${item.id}`} type="button" role="option" aria-selected="false" onClick={() => { router.push(group.href(item)); setSearchQuery("") }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#f7f6f2]">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          {group.detail(item) && <span className="mt-0.5 block truncate text-xs text-[#777]">{group.detail(item)}</span>}
                        </button>)}
                      </section>)}
              </div>}
            </div>
            <div ref={notificationRef} className="relative">
              <button
                type="button"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative rounded-lg p-2.5 text-[#777] transition-colors hover:bg-[#f7f6f2] hover:text-[#493323]"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-[#a97b4c] text-[10px] font-semibold leading-none text-white">{unreadCount}</span>}
              </button>
              {notificationsOpen && (
                <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e8e6e0] bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#eee] px-4 py-3.5">
                    <div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-0.5 text-xs text-[#888]">{unreadCount} unread</p></div>
                    <button type="button" disabled={!unreadCount} onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, unread: false })))} className="text-xs font-medium text-[#6f4e37] hover:underline disabled:cursor-default disabled:text-[#aaa] disabled:no-underline">Mark all as read</button>
                  </div>
                  <ul className="max-h-[min(24rem,65vh)] overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification.id} className={cn("border-b border-[#f1f0ed] last:border-0", notification.unread && "bg-[#fbfaf7]")}>
                        <button type="button" onClick={() => markNotificationRead(notification.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-[#f7f6f2]">
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.unread ? "bg-[#a97b4c]" : "bg-transparent")} />
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{notification.title}</span><span className="mt-0.5 block text-xs text-[#777]">{notification.detail}</span><span className="mt-1.5 block text-[11px] text-[#aaa]">{notification.time}</span></span>
                          {!notification.unread && <Check aria-label="Read" className="mt-1 size-4 shrink-0 text-[#4e8a65]" />}
                        </button>
                      </li>
                    ))}
                    {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#999]">No notifications yet.</li>}
                  </ul>
                </div>
              )}
            </div>
            <Link href="/admin/profile" aria-label={`Admin profile: ${profileName}`} className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-[#f7f6f2] sm:gap-2.5 sm:pl-2">
              <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-[#6f4e37] text-xs font-semibold text-white sm:size-10">{user?.imageUrl ? <img src={user.imageUrl} alt="" className="size-full object-cover" /> : initials}</span>
              <span className="hidden text-left sm:block"><span className="block max-w-28 truncate text-xs font-semibold text-[#333]">{profileName}</span><span className="mt-0.5 block text-[11px] text-[#888]">Administrator</span></span>
            </Link>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
    </div>
    </div>
    </AdminDataProvider>
  )
}

function SidebarContent({ collapsed = false, pathname }: { collapsed?: boolean; pathname: string }) {
  return <div className="flex min-h-full flex-col px-3 py-5">
    <div className={cn("mb-8 flex items-center gap-3 px-2", collapsed && "justify-center")}><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kalpanika-aSSKdYSGeA92HvyWlr3hZg3AIDVPfT.png" alt="Kalpanika logo" className="size-14 shrink-0 bg-white object-contain" />{!collapsed && <div><p className="font-serif text-lg leading-none">Kalpanika</p><p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#999]">Admin studio</p></div>}</div>
    <nav className="flex-1">{groups.map((group) => <div key={group.label} className="mb-6"><p className={cn("mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#aaa]", collapsed && "sr-only")}>{group.label}</p>{group.items.map((item) => { const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href); const Icon = item.icon; return <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={cn("mb-1 flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-colors", active ? "bg-[#f1ebe4] font-medium text-[#6f4e37]" : "text-[#777] hover:bg-[#f7f6f2] hover:text-[#191919]", collapsed && "justify-center px-0")}><Icon />{!collapsed && <span>{item.label}</span>}</Link>})}</div>)}</nav>
    <Link href="/" className={cn("flex items-center gap-2 border-t border-[#eee] px-2 pt-4 text-xs text-[#777] hover:text-[#6f4e37]", collapsed && "justify-center")}><ExternalLink />{!collapsed && "View storefront"}</Link>
  </div>
}
