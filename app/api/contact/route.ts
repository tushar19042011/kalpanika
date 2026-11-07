import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { consumePublicSubmissionQuota } from "@/lib/public-form-security"
import { databaseErrorMessage, getDatabase } from "@/lib/mongodb"
import type { SupportRequestDocument } from "@/lib/store-models"

export async function POST(request: Request) {
  try {
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "Enter valid contact details." }, { status: 400 })
    }

    const body = input as Record<string, unknown>
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const website = typeof body.website === "string" ? body.website.trim() : ""
    if (website) return NextResponse.json({ error: "Unable to submit this request." }, { status: 400 })
    if (
      !name || name.length > 100
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || orderNumber.length > 80
      || message.length < 10 || message.length > 4000
    ) {
      return NextResponse.json({
        error: "Enter your name, a valid email address, and a message between 10 and 4,000 characters.",
      }, { status: 400 })
    }
    if (!await consumePublicSubmissionQuota(request, "contact", 5)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const now = new Date()
    const supportRequest: Omit<SupportRequestDocument, "_id"> = {
      name,
      email,
      orderNumber,
      message,
      status: "new",
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ status: "new", updatedAt: now, updatedBy: "system" }],
    }
    await (await getDatabase()).collection<SupportRequestDocument>("supportRequests").insertOne({
      ...supportRequest,
      _id: new ObjectId(),
    })
    return NextResponse.json({
      message: "Your support request has been received and saved. Email notifications are not configured, so no email confirmation was sent.",
    }, { status: 201 })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
    }
    console.error("Could not save contact request.", error)
    return NextResponse.json({
      error: databaseErrorMessage(error, "Your request could not be saved. Please try again later."),
    }, { status: 503 })
  }
}
