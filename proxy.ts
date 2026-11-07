import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isCustomerRoute = createRouteMatcher(['/checkout', '/cart', '/account(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  const pathname = req.nextUrl.pathname

  if (isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`, req.url))
    }

    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : ''

    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  }

  if (isCustomerRoute(req) && !userId) {
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`, req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|json|map)).*)',
    '/api/(.*)',
  ],
}
