import "server-only"
import { auth, currentUser } from "@clerk/nextjs/server"

export class AuthorizationError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message)
    this.name = "AuthorizationError"
  }
}

export async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) throw new AuthorizationError(401, "Authentication required.")

  const user = await currentUser()
  if (user?.id !== userId || user.publicMetadata.role !== "admin") {
    throw new AuthorizationError(403, "Administrator access required.")
  }

  return { userId }
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  return null
}
