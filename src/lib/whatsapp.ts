import type { CheckoutDetails, Product, StoreSettings } from '../types'
import { formatIDR } from './money'

export function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

export function buildWhatsAppMessage(
  store: StoreSettings,
  details: CheckoutDetails,
  items: Array<{ product: Product; quantity: number }>,
): string {
  const lines = [
    `Halo ${store.store_name} - ${store.branch_name}, saya ingin memesan:`,
    '',
    `Nama: ${details.customerName.trim()}`,
    ...(details.customerPhone.trim() ? [`Nomor WhatsApp: ${details.customerPhone.trim()}`] : []),
    `Jenis pesanan: ${details.orderType === 'delivery' ? 'Antar' : 'Ambil sendiri'}`,
    ...(details.orderType === 'delivery' && details.address.trim() ? [`Alamat: ${details.address.trim()}`] : []),
    '',
    'Pesanan:',
    ...items.map(({ product, quantity }) =>
      `- ${product.name} x${quantity} @ ${formatIDR(product.price)} = ${formatIDR(product.price * quantity)}`,
    ),
    `Subtotal: ${formatIDR(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0))}`,
    ...(details.orderType === 'delivery' && store.delivery_fee > 0
      ? [`Biaya antar: ${formatIDR(store.delivery_fee)}`]
      : []),
    `Total: ${formatIDR(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) + (details.orderType === 'delivery' ? store.delivery_fee : 0))}`,
    ...(details.notes.trim() ? ['', `Catatan: ${details.notes.trim()}`] : []),
    '',
    'Saya akan mengirim pesanan ini setelah menekan tombol Kirim di WhatsApp.',
  ]
  return lines.join('\n')
}

export function buildWhatsAppUrl(number: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(number)
  if (!/^62\d{8,13}$/.test(normalized)) throw new Error('Nomor WhatsApp toko belum dikonfigurasi dengan format internasional yang valid.')
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
