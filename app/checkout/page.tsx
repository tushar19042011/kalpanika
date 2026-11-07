'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft, Check, ChevronRight, LockKeyhole, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react'
import { StorefrontShell, useCart } from '@/components/storefront-shell'
import { useCategoryData } from '@/components/category-data-provider'
import { formatPrice } from '@/lib/products'

const inputClass = 'mt-2 w-full rounded-xl border border-[#ded4c2] bg-white px-4 py-3 text-sm text-[#191919] outline-none transition placeholder:text-[#aaa092] focus:border-[#6f4e37] focus:ring-4 focus:ring-[#d8c47a]/25'
const sectionClass = 'rounded-2xl border border-[#e7dfd1] bg-white p-5 shadow-[0_10px_35px_rgba(73,51,35,0.04)] sm:p-7'

type FormState = { firstName: string; lastName: string; email: string; phone: string; address: string; landmark: string; city: string; state: string; pin: string; country: string }

export default function CheckoutPage() {
  return <StorefrontShell><CheckoutContent /></StorefrontShell>
}

function CheckoutContent() {
  const router = useRouter()
  const { isLoaded, isSignedIn, user } = useUser()
  const { items, subtotal, updateQuantity, removeFromBag, clearCart, cartReady, cartError } = useCart()
  const { products } = useCategoryData()
  const idempotencyKey = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [form, setForm] = useState<FormState>({ firstName: '', lastName: '', email: '', phone: '', address: '', landmark: '', city: '', state: '', pin: '', country: 'India' })
  const productsInCart = useMemo(() => items.map((item) => ({ ...item, product: products.find((product) => product.slug === item.slug) })).filter((item) => item.product), [items, products])

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/sign-in?redirect_url=/checkout')
    }
  }, [isLoaded, isSignedIn, router])
  useEffect(() => {
    if (!isLoaded || !user) return
    setForm((current) => ({
      ...current,
      firstName: current.firstName || user.firstName || '',
      lastName: current.lastName || user.lastName || '',
      email: current.email || user.primaryEmailAddress?.emailAddress || '',
    }))
  }, [isLoaded, user])

  if (!isLoaded || !isSignedIn) {
    return <main className="mx-auto flex min-h-[62vh] max-w-3xl items-center justify-center px-5 py-20"><div className="h-8 w-40 animate-pulse rounded bg-[#f1e6d2]" /></main>
  }

  if (!cartReady) return <main role="status" className="mx-auto flex min-h-[62vh] max-w-3xl items-center justify-center px-5 py-20 text-sm text-[#777064]">Loading your bag…</main>
  if (cartError) return <main role="alert" className="mx-auto flex min-h-[62vh] max-w-3xl items-center justify-center px-5 py-20 text-center text-sm text-[#a34d4d]">{cartError}</main>
  if (!items.length) return <main className="mx-auto flex min-h-[62vh] max-w-3xl flex-col items-center justify-center px-5 py-20 text-center"><div className="flex size-16 items-center justify-center rounded-full bg-[#f7f1e3]"><ShoppingBag className="text-[#6f4e37]" /></div><p className="eyebrow mt-7">Checkout</p><h1 className="mt-3 text-4xl font-medium tracking-tight">Your bag is empty.</h1><p className="mt-4 max-w-md text-[#777064]">Choose an object with a point of view and it will appear here.</p><Link href="/products" className="mt-8 rounded-full bg-[#493323] px-6 py-3 text-sm text-white">Explore the collection</Link></main>

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('')
    if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); return }
    setSubmitting(true)
    idempotencyKey.current ??= crypto.randomUUID()
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          items,
          customer: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
          shipping: form,
          paymentMethod,
        }),
      })
      const data = await response.json() as { orderId?: string; error?: string }
      if (!response.ok || !data.orderId) {
        setError(data.error ?? 'Please check your details and try again.')
        setSubmitting(false)
        return
      }
      await clearCart()
      router.push(`/order-confirmation/${data.orderId}`)
    } catch (submitError) {
      console.error('Unable to submit checkout.', submitError)
      setError('The order could not be submitted. Please try again.')
      setSubmitting(false)
    }
  }

  return <main className="bg-[#fbfaf7]"><div className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 md:px-10 md:pb-28 md:pt-12"><div className="mb-10 flex flex-wrap items-center justify-between gap-4"><Link href="/products" className="inline-flex items-center gap-2 text-sm text-[#777064] transition-colors hover:text-[#493323]"><ArrowLeft className="size-4" /> Continue shopping</Link><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#777064]"><LockKeyhole className="size-4 text-[#6f4e37]" /> Secure checkout</div></div><div className="mb-10 border-b border-[#e7dfd1] pb-8"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a97b4c]"><span className="flex size-6 items-center justify-center rounded-full bg-[#493323] text-white">1</span><span>Details</span><ChevronRight className="size-3" /><span className="text-[#aaa092]">Review & payment</span></div><h1 className="mt-5 max-w-2xl text-4xl font-medium tracking-[-0.05em] text-[#2e241c] sm:text-5xl">Make it yours.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#777064]">A few details, then your objects are ready to travel to their new home.</p></div><div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12"><form onSubmit={handleSubmit} className="grid gap-5"><section className={sectionClass}><div className="flex items-start gap-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f7f1e3] text-sm font-semibold text-[#6f4e37]">01</div><div><h2 className="text-lg font-medium">Contact details</h2><p className="mt-1 text-sm text-[#777064]">We’ll send your order updates here.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm">First name<span className="text-[#a34d4d]"> *</span><input required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputClass} autoComplete="given-name" /></label><label className="text-sm">Last name<span className="text-[#a34d4d]"> *</span><input required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputClass} autoComplete="family-name" /></label><label className="text-sm sm:col-span-2">Email address<span className="text-[#a34d4d]"> *</span><input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} autoComplete="email" /></label><label className="text-sm sm:col-span-2">Phone number<span className="text-[#a34d4d]"> *</span><input required type="tel" pattern="[+]?[0-9]{10,13}" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} placeholder="+91 98765 43210" autoComplete="tel" /></label></div></section><section className={sectionClass}><div className="flex items-start gap-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f7f1e3] text-sm font-semibold text-[#6f4e37]">02</div><div><h2 className="text-lg font-medium">Shipping address</h2><p className="mt-1 text-sm text-[#777064]">Where should we send your pieces?</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">House / flat / building<span className="text-[#a34d4d]"> *</span><input required value={form.address} onChange={(e) => update('address', e.target.value)} className={inputClass} autoComplete="street-address" /></label><label className="text-sm sm:col-span-2">Landmark <span className="text-[#aaa092]">(optional)</span><input value={form.landmark} onChange={(e) => update('landmark', e.target.value)} className={inputClass} /></label><label className="text-sm">City<span className="text-[#a34d4d]"> *</span><input required value={form.city} onChange={(e) => update('city', e.target.value)} className={inputClass} autoComplete="address-level2" /></label><label className="text-sm">State<span className="text-[#a34d4d]"> *</span><input required value={form.state} onChange={(e) => update('state', e.target.value)} className={inputClass} autoComplete="address-level1" /></label><label className="text-sm">PIN code<span className="text-[#a34d4d]"> *</span><input required pattern="[0-9]{6}" inputMode="numeric" value={form.pin} onChange={(e) => update('pin', e.target.value)} className={inputClass} autoComplete="postal-code" /></label><label className="text-sm">Country<input readOnly value={form.country} className={`${inputClass} text-[#777064]`} /></label></div></section><section className={sectionClass}><div className="flex items-start gap-4"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f7f1e3] text-sm font-semibold text-[#6f4e37]">03</div><div><h2 className="text-lg font-medium">Payment method</h2><p className="mt-1 text-sm text-[#777064]">Choose how you’d like to pay.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{[['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Net banking']].map(([value, label]) => <label key={value} className={`relative cursor-pointer rounded-xl border p-4 text-sm transition-colors ${paymentMethod === value ? 'border-[#6f4e37] bg-[#f7f1e3]' : 'border-[#e7dfd1] hover:border-[#bca990]'}`}><input type="radio" name="payment" value={value} checked={paymentMethod === value} onChange={(e) => setPaymentMethod(e.target.value)} className="sr-only" /><span className="flex items-center gap-2">{paymentMethod === value && <Check className="size-4 text-[#6f4e37]" />} {label}</span></label>)}</div><div className="mt-5 flex gap-3 rounded-xl bg-[#fbfaf7] p-4 text-xs leading-5 text-[#777064]"><ShieldCheck className="size-4 shrink-0 text-[#6f4e37]" /><span>Payment gateway setup is pending. No card details are collected here; your order will be created as payment pending.</span></div></section>{error && <p role="alert" className="rounded-xl bg-[#f7e8df] px-4 py-3 text-sm text-[#8b3e2f]">{error}</p>}<button disabled={submitting} className="w-full rounded-xl bg-[#493323] px-6 py-4 text-sm font-medium text-white shadow-[0_10px_20px_rgba(73,51,35,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#6f4e37] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Creating order…' : 'Place order'} <span className="ml-2 opacity-70">· {formatPrice(subtotal)}</span></button></form><aside className="lg:sticky lg:top-28"><div className="overflow-hidden rounded-2xl bg-[#493323] text-[#fffaf1] shadow-[0_18px_45px_rgba(73,51,35,0.17)]"><div className="p-6 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-[#d8c47a]">Your order</p><h2 className="mt-2 text-xl font-medium">A considered collection</h2></div><ShoppingBag className="size-5 text-[#d8c47a]" /></div><div className="mt-7 flex flex-col gap-5">{productsInCart.map(({ product, quantity, slug }) => product && <div className="flex gap-4" key={slug}><div className={`product-art ${product.imageClass} size-[68px] shrink-0 rounded-lg`} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-sm font-medium">{product.name}</p><p className="whitespace-nowrap text-sm">{formatPrice(product.price * quantity)}</p></div><div className="mt-3 flex items-center gap-3 text-xs text-[#d8cfc4]"><button type="button" aria-label={`Decrease ${product.name}`} onClick={() => updateQuantity(slug, quantity - 1)} className="rounded-full border border-white/20 p-1 hover:border-[#d8c47a]"><Minus className="size-3" /></button><span>{quantity}</span><button type="button" aria-label={`Increase ${product.name}`} onClick={() => updateQuantity(slug, quantity + 1)} className="rounded-full border border-white/20 p-1 hover:border-[#d8c47a]"><Plus className="size-3" /></button><button type="button" className="ml-auto underline underline-offset-2 hover:text-white" onClick={() => removeFromBag(slug)}>Remove</button></div></div></div>)}</div><div className="mt-7 border-t border-white/15 pt-5 text-sm"><div className="flex justify-between text-[#d8cfc4]"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div className="mt-3 flex justify-between text-[#d8cfc4]"><span>Shipping</span><span>Calculated after review</span></div><div className="mt-5 flex justify-between border-t border-white/15 pt-5 text-base font-medium"><span>Total</span><span>{formatPrice(subtotal)}</span></div></div></div><div className="flex items-center gap-3 border-t border-white/15 bg-[#3c2a20] px-6 py-4 text-xs text-[#d8cfc4] sm:px-7"><Truck className="size-4 shrink-0 text-[#d8c47a]" /><span>Thoughtfully packed and dispatched in 3–5 business days.</span></div></div></aside></div></div></main>
}
