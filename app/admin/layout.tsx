import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()

  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent('/admin')}`)
  }

  const user = await currentUser()
  const role = typeof user?.publicMetadata?.role === 'string' ? user.publicMetadata.role : ''

  if (role !== 'admin') {
    redirect('/')
  }

  return <AdminShell>{children}</AdminShell>
}
