import { CustomerDetailPage } from "@/components/admin/customer-management-page"

export default async function CustomerDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CustomerDetailPage customerId={id} />
}
