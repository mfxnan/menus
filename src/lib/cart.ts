import type { CartItem, Product } from '../types'

const STORAGE_KEY = 'rocket-chicken-cart-v1'

export function parseCart(value: string | null): CartItem[] {
  if (!value) return []
  try {
    const data: unknown = JSON.parse(value)
    if (!Array.isArray(data)) return []
    return data.filter((item): item is CartItem =>
      typeof item === 'object' && item !== null &&
      typeof item.productId === 'string' &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0,
    )
  } catch {
    return []
  }
}

export function loadCart(): CartItem[] {
  try {
    return parseCart(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function saveCart(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage can be unavailable in private browsing; cart still works in memory.
  }
}

export function setQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return items
  if (quantity === 0) return items.filter((item) => item.productId !== productId)
  const exists = items.some((item) => item.productId === productId)
  return exists
    ? items.map((item) => item.productId === productId ? { ...item, quantity } : item)
    : [...items, { productId, quantity }]
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function cartTotal(items: CartItem[], products: Product[]): number {
  const byId = new Map(products.map((product) => [product.id, product]))
  return items.reduce((total, item) => total + (byId.get(item.productId)?.price ?? 0) * item.quantity, 0)
}

export function validCartItems(items: CartItem[], products: Product[]): CartItem[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  return items.filter((item) => {
    const product = byId.get(item.productId)
    return product?.is_available && product.is_published && !product.archived_at && item.quantity > 0
  })
}
