import { ProductRouteDialog } from "@/components/admin/product-route-dialog"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProductRouteDialog productId={id} />
}
