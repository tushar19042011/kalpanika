import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { consumePublicSubmissionQuota } from "@/lib/public-form-security"
import { getDatabase } from "@/lib/mongodb"
import { buildPricingQuote, PricingError, type PricingRequestLine } from "@/lib/pricing"

export const dynamic = "force-dynamic"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Sign in to review your checkout." }, { status: 401 })
    const body: unknown = await request.json()
    if (!isRecord(body) || !Array.isArray(body.items) || body.items.length > 20) {
      return NextResponse.json({ error: "Your bag is empty or contains too many products." }, { status: 400 })
    }
    const items: PricingRequestLine[] = []
    for (const raw of body.items) {
      if (!isRecord(raw) || typeof raw.slug !== "string" || !/^[a-z0-9-]{1,140}$/.test(raw.slug)
        || typeof raw.quantity !== "number" || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 20) {
        return NextResponse.json({ error: "Your bag contains an invalid product or quantity." }, { status: 400 })
      }
      items.push({ slug: raw.slug, quantity: raw.quantity })
    }
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.slice(0, 60) : ""
    if (couponCode.trim() && !await consumePublicSubmissionQuota(request, "coupon", 12, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many coupon attempts. Please try again later." }, { status: 429 })
    }
    const { quote } = await buildPricingQuote(await getDatabase(), items, userId, couponCode)
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    }
    if (error instanceof PricingError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Could not calculate checkout pricing.", error)
    return NextResponse.json({ error: "Pricing is temporarily unavailable." }, { status: 503 })
  }
}
