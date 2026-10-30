import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import { filterProducts } from './catalog'

const products: Product[] = [
  { id: '1', name: 'Ayam Original', description: 'Ayam renyah', price: 12000, category_id: 'chicken', image_path: null, is_available: true, is_published: true, sort_order: 0, archived_at: null },
  { id: '2', name: 'Es Teh', description: 'Teh manis', price: 4000, category_id: 'drink', image_path: null, is_available: true, is_published: true, sort_order: 1, archived_at: null },
]

describe('catalog filtering', () => {
  it('combines category and case-insensitive name/description search', () => {
    expect(filterProducts(products, 'chicken', ' RENYAH ')).toEqual([products[0]])
    expect(filterProducts(products, 'drink', 'ayam')).toEqual([])
    expect(filterProducts(products, 'all', 'teh')).toEqual([products[1]])
  })
})
