'use client'

import { useState } from 'react'
import { useCart } from '@/components/storefront-shell'
import { useCategoryData } from '@/components/category-data-provider'

export function AddToBagButton({ slug }: { slug: string }) {
  const { addToBag } = useCart()
  const { products } = useCategoryData()
  const product = products.find((item) => item.slug === slug)
  const [added, setAdded] = useState(false)
  const handleClick = async () => {
    if (await addToBag(slug)) {
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1600)
    }
  }
  return <button onClick={() => void handleClick()} disabled={!product || product.active === false || !product.stock} className="button-primary flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50">{!product?.stock ? 'Out of stock' : added ? 'Added to bag' : 'Add to bag'}</button>
}
