import "server-only"
import { createHash, createHmac } from "node:crypto"

export class NewsletterEmailError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = "NewsletterEmailError"
  }
}

export function appUrl(path: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!configuredUrl) throw new Error("NEXT_PUBLIC_APP_URL must be configured for newsletter links.")
  const url = new URL(configuredUrl)
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS outside localhost.")
  }
  return new URL(path, url).toString()
}

function tokenSecret() {
  const secret = process.env.NEWSLETTER_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("NEWSLETTER_TOKEN_SECRET must contain at least 32 characters.")
  }
  return secret
}

export function hashNewsletterToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createUnsubscribeToken(subscriberId: string, version: string) {
  return createHmac("sha256", tokenSecret()).update(`newsletter-unsubscribe:${subscriberId}:${version}`).digest("base64url")
}

export function hashUnsubscribeToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function newsletterFrom() {
  const email = process.env.NEWSLETTER_FROM_EMAIL?.trim()
  if (!email || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) {
    throw new Error("NEWSLETTER_FROM_EMAIL must be a verified sender address.")
  }
  const name = (process.env.NEWSLETTER_FROM_NAME?.trim() || "Kalpanika").replace(/[<>"]/g, "")
  return `${name} <${email}>`
}

export function validateNewsletterEmailConfiguration() {
  if (!process.env.RESEND_API_KEY?.trim()) throw new Error("RESEND_API_KEY is not configured.")
  newsletterFrom()
  tokenSecret()
  appUrl("/")
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEWSLETTER_ENABLE_REAL_DELIVERY !== "true") {
      throw new Error("Real newsletter delivery is disabled. Set NEWSLETTER_ENABLE_REAL_DELIVERY=true after verifying sender configuration.")
    }
  } else {
    const testRecipient = process.env.NEWSLETTER_TEST_RECIPIENT?.trim()
    if (!testRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testRecipient)) {
      throw new Error("Configure NEWSLETTER_TEST_RECIPIENT to a safe test inbox before sending in non-production environments.")
    }
  }
}

export async function sendNewsletterEmail(input: {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}) {
  validateNewsletterEmailConfiguration()
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.")
  const recipient = process.env.NODE_ENV === "production"
    ? input.to
    : process.env.NEWSLETTER_TEST_RECIPIENT?.trim()
  if (!recipient) throw new Error("NEWSLETTER_TEST_RECIPIENT is not configured.")
  const recipients = [recipient]
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from: newsletterFrom(),
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    throw new NewsletterEmailError(error instanceof Error ? error.message : "Email provider request failed.", true)
  })

  const result = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string }
  if (!response.ok || !result.id) {
    const message = result.message || result.name || `Email provider returned HTTP ${response.status}.`
    throw new NewsletterEmailError(message, response.status === 429 || response.status >= 500)
  }
  return result.id
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!)
}

export function verificationEmail(input: { name: string; url: string }) {
  const name = escapeEmailHtml(input.name)
  const url = escapeEmailHtml(input.url)
  return {
    subject: "Confirm your Kalpanika product updates",
    html: `<!doctype html><html><body style="margin:0;background:#fffcf5;color:#493323;font-family:Arial,sans-serif"><main style="max-width:560px;margin:40px auto;padding:32px"><p style="font-size:13px;letter-spacing:4px;color:#6f4e37">KALPANIKA</p><h1 style="font-size:28px;font-weight:500">Confirm your subscription</h1><p style="font-size:16px;line-height:1.7">Hello ${name}, confirm that you want to receive email updates when new products arrive.</p><p style="margin:32px 0"><a href="${url}" style="background:#493323;border-radius:28px;color:#fff;padding:14px 22px;text-decoration:none">Confirm email</a></p><p style="font-size:12px;line-height:1.6;color:#777064">This confirmation link expires in 24 hours. If you did not request updates, you can ignore this message.</p></main></body></html>`,
    text: `KALPANIKA\n\nHello ${input.name},\n\nConfirm that you want to receive email updates when new products arrive:\n${input.url}\n\nThis confirmation link expires in 24 hours. If you did not request updates, ignore this message.`,
  }
}

export function productAnnouncementEmail(input: {
  name: string
  description: string
  price: string
  productUrl: string
  imageUrl: string | null
  unsubscribeUrl: string
}) {
  const name = escapeEmailHtml(input.name)
  const description = escapeEmailHtml(input.description)
  const productUrl = escapeEmailHtml(input.productUrl)
  const unsubscribeUrl = escapeEmailHtml(input.unsubscribeUrl)
  const image = input.imageUrl
    ? `<a href="${productUrl}"><img src="${escapeEmailHtml(input.imageUrl)}" alt="${name}" style="display:block;width:100%;height:auto;border-radius:8px;margin:24px 0"></a>`
    : ""
  return {
    subject: `New at Kalpanika: ${input.name}`,
    html: `<!doctype html><html><body style="margin:0;background:#fffcf5;color:#493323;font-family:Arial,sans-serif"><main style="max-width:600px;margin:32px auto;padding:28px"><p style="font-size:13px;letter-spacing:4px;color:#6f4e37">KALPANIKA</p><h1 style="font-size:30px;font-weight:500">Something new just arrived.</h1>${image}<h2 style="font-size:23px">${name}</h2><p style="font-size:16px;line-height:1.7;color:#777064">${description}</p><p style="font-size:18px">${escapeEmailHtml(input.price)}</p><p style="margin:30px 0"><a href="${productUrl}" style="background:#493323;border-radius:28px;color:#fff;padding:14px 22px;text-decoration:none">View product</a></p><p style="font-size:12px;line-height:1.6;color:#777064">You received this because you confirmed product announcement emails from Kalpanika. <a href="${unsubscribeUrl}" style="color:#6f4e37">Unsubscribe</a></p></main></body></html>`,
    text: `KALPANIKA\n\nSomething new just arrived.\n\n${input.name}\n${input.description}\n${input.price}\n\nView product: ${input.productUrl}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
  }
}
