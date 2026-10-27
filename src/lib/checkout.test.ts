import { describe, expect, it } from 'vitest'
import { formatIDR } from './money'
import { buildWhatsAppMessage, buildWhatsAppUrl, normalizeWhatsAppNumber } from './whatsapp'
import { validateCheckout } from './validation'
import type { CheckoutDetails, Product, StoreSettings } from '../types'

const settings: StoreSettings = {
  id: 1, store_name: 'Rocket Chicken', branch_name: 'KS Tubun Purwokerto', whatsapp_number: '6281234567890',
  contact_information: '', address: '', opening_hours: '', takeaway_enabled: true,
  delivery_enabled: true, delivery_address_required: true, delivery_fee: 4000,
  customer_phone_required: false, public_information: '',
}
const details: CheckoutDetails = { customerName: 'Dina', customerPhone: '081234', orderType: 'delivery', address: 'Jalan Mawar 1', notes: 'Sambal dipisah' }
const product: Product = { id: 'a', name: 'Ayam Geprek', description: '', price: 16000, category_id: 'c', image_path: null, is_available: true, is_published: true, sort_order: 1, archived_at: null }

describe('checkout helpers', () => {
  it('formats Rupiah without fractional units', () => {
    expect(formatIDR(12000)).toContain('12.000')
    expect(formatIDR(0)).toContain('0')
  })

  it('normalizes common Indonesian phone formats to international digits', () => {
    expect(normalizeWhatsAppNumber('+62 812-3456-7890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('0812 3456 7890')).toBe('6281234567890')
    expect(normalizeWhatsAppNumber('81234567890')).toBe('6281234567890')
  })

  it('validates empty carts, customer details, delivery address and availability', () => {
    expect(validateCheckout(details, settings, [])).toMatch(/Keranjang kosong/)
    expect(validateCheckout({ ...details, customerName: '' }, settings, [{ product, quantity: 1 }])).toMatch(/Nama/)
    expect(validateCheckout({ ...details, address: '' }, settings, [{ product, quantity: 1 }])).toMatch(/Alamat/)
    expect(validateCheckout(details, settings, [{ product: { ...product, is_available: false }, quantity: 1 }])).toMatch(/tidak tersedia/)
    expect(validateCheckout({ ...details, orderType: 'takeaway' }, settings, [{ product, quantity: 1 }])).toBeNull()
  })

  it('includes quantities, subtotals, delivery fee, total and customer notes in encoded WhatsApp checkout', () => {
    const message = buildWhatsAppMessage(settings, details, [{ product, quantity: 2 }])
    expect(message).toContain('Rocket Chicken - KS Tubun Purwokerto')
    expect(message).toContain('Nama: Dina')
    expect(message).toContain('Nomor WhatsApp: 081234')
    expect(message).toContain('Alamat: Jalan Mawar 1')
    expect(message).toContain('Ayam Geprek x2')
    expect(message).toContain('Biaya antar: Rp')
    expect(message).toContain('Total: Rp')
    expect(message).toContain(`Total: ${formatIDR(36000)}`)
    expect(message).toContain('Catatan: Sambal dipisah')
    expect(message).toContain('menekan tombol Kirim')
    const url = buildWhatsAppUrl(settings.whatsapp_number, message)
    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/)
    expect(url).toContain(encodeURIComponent(message))
    expect(() => buildWhatsAppUrl('', message)).toThrow(/belum dikonfigurasi/)
  })
})
