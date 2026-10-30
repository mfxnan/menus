import type { Product } from '../types'

export function filterProducts(products: Product[], categoryId: string, search: string): Product[] {
  const query = search.trim().toLocaleLowerCase('id-ID')
  return products.filter((product) => {
    const matchesCategory = categoryId === 'all' || product.category_id === categoryId
    const matchesQuery = !query || `${product.name} ${product.description}`.toLocaleLowerCase('id-ID').includes(query)
    return matchesCategory && matchesQuery
  })
}
