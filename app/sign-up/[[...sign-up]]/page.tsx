import { SignUp } from '@clerk/nextjs'

type SearchParams = Promise<{ redirect_url?: string | string[] }>

export default async function SignUpPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {}
  const redirectUrl = Array.isArray(params.redirect_url) ? params.redirect_url[0] : params.redirect_url

  return <main className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-5 py-12"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl={redirectUrl || undefined} fallbackRedirectUrl={redirectUrl || undefined} /></main>
}
