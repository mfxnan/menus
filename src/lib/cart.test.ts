import { describe, expect, it } from 'vitest'
import { cartCount, cartTotal, parseCart, setQuantity, validCartItems } from './cart'
import type { Product } from '../types'

const products: Product[] = [
  { id: 'a', name: 'Ayam', description: '', price: 12000, category_id: 'c', image_path: null, is_available: true, is_published: true, sort_order: 0, archived_at: null },
  { id: 'b', name: 'Teh', description: '', price: 5000, category_id: 'c', image_path: null, is_available: false, is_published: true, sort_order: 1, archived_at: null },
]

describe('cart helpers', () => {
  it('ignores malformed saved entries', () => {
    expect(parseCart('[{"productId":"x","quantity":-1},{"productId":"a","quantity":2}]')).toEqual([{ productId: 'a', quantity: 2 }])
    expect(parseCart('{broken')).toEqual([])
  })

  it('adds, updates, removes and counts items with valid quantities', () => {
    const one = setQuantity([], 'a', 1)
    const two = setQuantity(one, 'a', 3)
    expect(cartCount(two)).toBe(3)
    expect(setQuantity(two, 'a', 0)).toEqual([])
    expect(setQuantity(two, 'a', -3)).toEqual(two)
    expect(setQuantity(two, 'a', 1.5)).toEqual(two)
  })

  it('calculates exact integer Rupiah totals and filters unavailable products', () => {
    const items = [{ productId: 'a', quantity: 2 }, { productId: 'b', quantity: 1 }, { productId: 'removed', quantity: 1 }]
    expect(cartTotal(items, products)).toBe(29000)
    expect(validCartItems(items, products)).toEqual([{ productId: 'a', quantity: 2 }])
  })
})
