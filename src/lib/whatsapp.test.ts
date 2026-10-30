import { describe, expect, it } from 'vitest'
import type { Product, StoreSettings } from '../types'
import { defaultSettings } from '../types'
import { buildWhatsAppMessage, buildWhatsAppUrl, isValidWhatsAppNumber, normalizeWhatsAppNumber } from './whatsapp'

const store: StoreSettings = { ...defaultSettings, store_name: 'Rocket Chicken', branch_name: 'KS Tubun', whatsapp_number: '6281234567890' }
const product: Product = {
  id: '1',
  name: 'Ayam Original',
  description: '',
  price: 12000,
  category_id: 'chicken',
  image_path: null,
  is_available: true,
  is_published: true,
  sort_order: 0,
  archived_at: null,
}

describe('WhatsApp checkout', () => {
  it('normalizes local Indonesian numbers and validates 8 to 13 digits after 62', () => {
    expect(normalizeWhatsAppNumber('0812 3456-7890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('+62 812-3456-7890')).toBe('6281234567890')
    expect(isValidWhatsAppNumber('081234567890')).toBe(true)
    expect(isValidWhatsAppNumber('6281234567')).toBe(true)
    expect(isValidWhatsAppNumber('6281234567890123')).toBe(false)
    expect(isValidWhatsAppNumber('nomor tidak valid')).toBe(false)
  })

  it('builds a Rupiah-formatted message without unavailable products', () => {
    const message = buildWhatsAppMessage(store, {
      customerName: 'Dina',
      customerPhone: '',
      orderType: 'takeaway',
      address: '',
      notes: '',
    }, [
      { product, quantity: 2 },
      { product: { ...product, id: '2', name: 'Ayam habis', is_available: false }, quantity: 1 },
    ])

    expect(message).toContain('Ayam Original x2 @ Rp\u00a012.000 = Rp\u00a024.000')
    expect(message).toContain('Subtotal: Rp\u00a024.000')
    expect(message).toContain('Total: Rp\u00a024.000')
    expect(message).not.toContain('Ayam habis')
  })

  it('encodes the message for a validated wa.me URL', () => {
    const url = buildWhatsAppUrl('081234567890', 'Menu ayam & es teh')
    expect(url).toBe('https://wa.me/6281234567890?text=Menu%20ayam%20%26%20es%20teh')
    expect(() => buildWhatsAppUrl('123', 'pesan')).toThrow(/format internasional/)
  })
})
