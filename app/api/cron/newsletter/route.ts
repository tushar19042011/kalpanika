import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { processNewsletterQueue } from "@/lib/newsletter-announcements"

export const dynamic = "force-dynamic"
export const maxDuration = 10

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) return false
  const authorization = request.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(authorization)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  try {
    const result = await processNewsletterQueue()
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Newsletter announcement worker failed.", error)
    return NextResponse.json({ error: "Newsletter processing is temporarily unavailable." }, { status: 503 })
  }
}

export const POST = GET
