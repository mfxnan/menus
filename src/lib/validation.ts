import type { CheckoutDetails, Product } from '../types'

export function validateCheckout(
  details: CheckoutDetails,
  settings: { delivery_enabled: boolean; takeaway_enabled: boolean; delivery_address_required: boolean; customer_phone_required: boolean },
  items: Array<{ product: Product; quantity: number }>,
): string | null {
  if (!items.length || items.some(({ quantity }) => !Number.isSafeInteger(quantity) || quantity <= 0)) return 'Keranjang kosong atau jumlah produk tidak valid.'
  if (!details.customerName.trim()) return 'Nama pelanggan wajib diisi.'
  if (settings.customer_phone_required && !details.customerPhone.trim()) return 'Nomor WhatsApp wajib diisi.'
  if (details.orderType === 'delivery') {
    if (!settings.delivery_enabled) return 'Layanan antar sedang tidak tersedia.'
    if (settings.delivery_address_required && !details.address.trim()) return 'Alamat pengantaran wajib diisi.'
  } else if (!settings.takeaway_enabled) {
    return 'Layanan ambil sendiri sedang tidak tersedia.'
  }
  if (items.some(({ product }) => !product.is_available || !product.is_published || product.archived_at)) return 'Ada produk yang sudah tidak tersedia. Perbarui keranjang Anda.'
  if (items.some(({ product, quantity }) => !Number.isSafeInteger(product.price) || product.price < 0 || !Number.isSafeInteger(quantity * product.price))) return 'Harga atau jumlah pesanan tidak valid.'
  return null
}

export function validateProduct(input: { name: string; price: number; category_id: string }): string | null {
  if (!input.name.trim()) return 'Nama produk wajib diisi.'
  if (!input.category_id) return 'Kategori produk wajib dipilih.'
  if (!Number.isSafeInteger(input.price) || input.price < 0) return 'Harga harus berupa bilangan Rupiah bulat dan tidak negatif.'
  return null
}

export function validateCategory(name: string): string | null {
  if (!name.trim()) return 'Nama kategori wajib diisi.'
  if (name.trim().length > 80) return 'Nama kategori maksimal 80 karakter.'
  return null
}
