import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"
import { adminErrorResponse, requireAdmin } from "@/lib/admin-auth"
import { getDatabase } from "@/lib/mongodb"
import type { SupportRequestDocument, SupportRequestStatus } from "@/lib/store-models"

const statuses: SupportRequestStatus[] = ["new", "in_progress", "resolved"]

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await requireAdmin()
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Support request not found." }, { status: 404 })
    const input: unknown = await request.json()
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return NextResponse.json({ error: "Invalid support request update." }, { status: 400 })
    }
    const body = input as Record<string, unknown>
    if (Object.keys(body).length !== 1 || typeof body.status !== "string" || !statuses.includes(body.status as SupportRequestStatus)) {
      return NextResponse.json({ error: "Select a valid request status." }, { status: 400 })
    }

    const database = await getDatabase()
    const collection = database.collection<SupportRequestDocument>("supportRequests")
    const requestId = new ObjectId(id)
    const current = await collection.findOne({ _id: requestId })
    if (!current) return NextResponse.json({ error: "Support request not found." }, { status: 404 })
    const status = body.status as SupportRequestStatus
    if (current.status !== status) {
      const now = new Date()
      const result = await collection.updateOne(
        { _id: requestId, status: current.status },
        {
          $set: { status, updatedAt: now },
          $push: { statusHistory: { status, updatedAt: now, updatedBy: userId } },
        },
      )
      if (!result.matchedCount) {
        return NextResponse.json({ error: "This request changed while you were editing it. Refresh and retry." }, { status: 409 })
      }
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const authorizationResponse = adminErrorResponse(error)
    if (authorizationResponse) return authorizationResponse
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 })
    console.error("Could not update support request.", error)
    return NextResponse.json({ error: "The support request could not be updated." }, { status: 503 })
  }
}
