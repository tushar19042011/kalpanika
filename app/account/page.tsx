'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUser, SignInButton, SignOutButton } from '@clerk/nextjs'
import { ArrowRight, Check, CircleUserRound, Heart, LogOut, Package, Settings, ShoppingBag, Sparkles } from 'lucide-react'
import { StorefrontShell } from '@/components/storefront-shell'
import { useWishlist } from '@/components/storefront-shell'
import { formatPrice } from '@/lib/products'

type AccountOrder = {
  orderId: string
  status: string
  paymentStatus: string
  total: number
  createdAt: string
  items: { name: string; quantity: number; price: number }[]
}

const navItems = [{ id: 'overview', label: 'Overview', icon: CircleUserRound }, { id: 'orders', label: 'Orders', icon: Package }, { id: 'wishlist', label: 'Wishlist', icon: Heart }, { id: 'settings', label: 'Settings', icon: Settings }]

export default function AccountPage() {
  return <StorefrontShell><AccountContent /></StorefrontShell>
}

function AccountContent() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { wishlistIds } = useWishlist()
  const [section, setSection] = useState('overview')
  const [orders, setOrders] = useState<AccountOrder[]>([])
  const [ordersError, setOrdersError] = useState('')
  const [ordersReady, setOrdersReady] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let cancelled = false
    fetch('/api/account/orders')
      .then(async (response) => {
        const data = await response.json() as { orders?: AccountOrder[]; error?: string }
        if (!response.ok) throw new Error(data.error ?? 'Order history is temporarily unavailable.')
        if (!cancelled) setOrders(Array.isArray(data.orders) ? data.orders : [])
      })
      .catch((error: unknown) => {
        if (!cancelled) setOrdersError(error instanceof Error ? error.message : 'Order history is temporarily unavailable.')
      })
      .finally(() => {
        if (!cancelled) setOrdersReady(true)
      })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn])
  if (!isLoaded) return <main className="mx-auto min-h-[65vh] max-w-6xl px-5 py-16 md:px-10"><div className="h-8 w-48 animate-pulse rounded bg-[#f1e6d2]" /></main>
  if (!isSignedIn || !user) return <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center"><div className="flex size-16 items-center justify-center rounded-full bg-[#f7f1e3] text-[#6f4e37]"><CircleUserRound className="size-7" /></div><p className="eyebrow mt-7">Your account</p><h1 className="mt-3 text-4xl font-medium tracking-[-0.05em]">A place for your objects.</h1><p className="mt-4 max-w-md text-sm leading-6 text-[#777064]">Sign in to see your orders, save favorites, and keep your details ready for the next thoughtful addition.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><SignInButton mode="modal"><button className="rounded-full bg-[#493323] px-6 py-3 text-sm text-white">Sign in</button></SignInButton><Link href="/products" className="rounded-full border border-[#d8cbb8] px-6 py-3 text-sm text-[#493323]">Explore objects</Link></div></main>
  const name = user.firstName || user.username || 'there'
  return <main className="bg-[#fbfaf7]"><div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-14"><div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14"><aside><p className="eyebrow">Your account</p><h1 className="mt-3 text-3xl font-medium tracking-[-0.05em]">Hello, {name}.</h1><nav className="mt-9 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1" aria-label="Account sections">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${section === id ? 'bg-[#493323] text-white' : 'text-[#777064] hover:bg-[#f1e6d2] hover:text-[#493323]'}`}><Icon className="size-4" />{label}</button>)}<SignOutButton><button className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#777064] hover:bg-[#f1e6d2] hover:text-[#493323]"><LogOut className="size-4" />Sign out</button></SignOutButton></nav></aside><section className="min-w-0">{section === 'overview' && <Overview user={user} onSection={setSection} orderCount={orders.length} wishlistCount={wishlistIds.length} />}{section === 'orders' && <OrdersSection orders={orders} ready={ordersReady} error={ordersError} />}{section === 'wishlist' && <EmptySection icon={Heart} title="Your wishlist" copy={`${wishlistIds.length} ${wishlistIds.length === 1 ? 'saved object' : 'saved objects'} in your wishlist.`} action="View wishlist" href="/wishlist" />}{section === 'settings' && <SettingsSection user={user} />}</section></div></div></main>
}

function Overview({ user, onSection, orderCount, wishlistCount }: { user: { imageUrl: string; fullName: string | null; primaryEmailAddress: { emailAddress: string } | null }; onSection: (section: string) => void; orderCount: number; wishlistCount: number }) { return <div><div className="flex flex-col justify-between gap-5 border-b border-[#e7dfd1] pb-7 sm:flex-row sm:items-end"><div><p className="text-sm text-[#777064]">A quiet corner for your Kalpanika journey.</p><h2 className="mt-2 text-2xl font-medium">Account overview</h2></div><Link href="/products" className="inline-flex items-center gap-2 text-sm text-[#6f4e37] hover:underline">Continue browsing <ArrowRight className="size-4" /></Link></div><div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#493323] p-5 text-white sm:col-span-2"><Sparkles className="size-5 text-[#d8c47a]" /><p className="mt-10 text-lg">Thoughtful objects, made layer by layer.</p><p className="mt-2 max-w-sm text-sm leading-6 text-[#d8cfc4]">Your account keeps your saved objects and order details close, so the next discovery feels effortless.</p></div><div className="rounded-2xl border border-[#e7dfd1] bg-white p-5"><div className="flex size-11 items-center justify-center overflow-hidden rounded-full bg-[#f1e6d2] text-[#6f4e37]">{user.imageUrl ? <img src={user.imageUrl} alt="" className="size-full object-cover" /> : <CircleUserRound />}</div><p className="mt-5 text-sm font-medium">{user.fullName || 'Your profile'}</p><p className="mt-1 truncate text-xs text-[#777064]">{user.primaryEmailAddress?.emailAddress}</p><button onClick={() => onSection('settings')} className="mt-5 text-xs text-[#6f4e37] underline underline-offset-4">Manage details</button></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><button onClick={() => onSection('orders')} className="rounded-2xl border border-[#e7dfd1] bg-white p-5 text-left transition-transform hover:-translate-y-0.5"><Package className="size-5 text-[#6f4e37]" /><p className="mt-8 font-medium">Orders</p><p className="mt-1 text-sm text-[#777064]">{orderCount} {orderCount === 1 ? 'order' : 'orders'}</p></button><button onClick={() => onSection('wishlist')} className="rounded-2xl border border-[#e7dfd1] bg-white p-5 text-left transition-transform hover:-translate-y-0.5"><Heart className="size-5 text-[#6f4e37]" /><p className="mt-8 font-medium">Wishlist</p><p className="mt-1 text-sm text-[#777064]">{wishlistCount} saved objects</p></button></div></div> }

function OrdersSection({ orders, ready, error }: { orders: AccountOrder[]; ready: boolean; error: string }) {
  if (!ready) return <p role="status" className="py-12 text-sm text-[#777064]">Loading your orders…</p>
  if (error) return <p role="alert" className="py-12 text-sm text-[#a34d4d]">{error}</p>
  if (orders.length === 0) return <EmptySection icon={Package} title="Your orders" copy="Your orders will appear here after checkout." action="Start exploring" href="/products" />
  return <div><h2 className="border-b border-[#e7dfd1] pb-6 text-2xl font-medium">Your orders</h2><div className="mt-5 grid gap-4">{orders.map((order) => <article key={order.orderId} className="rounded-2xl border border-[#e7dfd1] bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-medium">{order.orderId}</p><p className="mt-1 text-xs text-[#777064]">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p></div><div className="text-right"><p className="font-medium">{formatPrice(order.total)}</p><p className="mt-1 text-xs capitalize text-[#777064]">{order.status} · Payment {order.paymentStatus}</p></div></div><div className="mt-4 border-t border-[#eee] pt-4 text-sm text-[#777064]">{order.items.map((item) => <p key={`${order.orderId}-${item.name}`}>{item.name} × {item.quantity}</p>)}</div></article>)}</div></div>
}

function EmptySection({ icon: Icon, title, copy, action, href }: { icon: typeof Package; title: string; copy: string; action: string; href: string }) { return <div className="rounded-2xl border border-[#e7dfd1] bg-white px-6 py-14 text-center sm:px-12"><div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f7f1e3] text-[#6f4e37]"><Icon className="size-6" /></div><h2 className="mt-6 text-2xl font-medium">{title}</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#777064]">{copy}</p><Link href={href} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#493323] px-5 py-3 text-sm text-white">{action}<ArrowRight className="size-4" /></Link></div> }

function SettingsSection({ user }: { user: { fullName: string | null; primaryEmailAddress: { emailAddress: string } | null } }) { return <div><div className="border-b border-[#e7dfd1] pb-7"><h2 className="text-2xl font-medium">Settings</h2><p className="mt-2 text-sm text-[#777064]">Your profile details are managed securely by Clerk.</p></div><div className="mt-6 rounded-2xl border border-[#e7dfd1] bg-white p-6"><div className="flex items-center gap-4"><div className="flex size-12 items-center justify-center rounded-full bg-[#f1e6d2] text-[#6f4e37]"><CircleUserRound /></div><div><p className="font-medium">{user.fullName || 'Kalpanika customer'}</p><p className="mt-1 text-sm text-[#777064]">{user.primaryEmailAddress?.emailAddress}</p></div></div><div className="mt-7 flex items-start gap-3 rounded-xl bg-[#fbfaf7] p-4 text-sm text-[#777064]"><Check className="mt-0.5 size-4 shrink-0 text-[#6f4e37]" /><p>Authentication, sessions, and profile security are powered by Clerk.</p></div></div></div> }
