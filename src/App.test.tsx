import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import type { Category, Product } from './types'

const { getCatalog, getStoreSettings } = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  getStoreSettings: vi.fn(),
}))

vi.mock('./lib/data', () => ({
  getCatalog,
  getStoreSettings,
  getAdminData: vi.fn(),
  saveProduct: vi.fn(),
  archiveProduct: vi.fn(),
  saveCategory: vi.fn(),
  archiveCategory: vi.fn(),
  saveSettings: vi.fn(),
  uploadProductImage: vi.fn(),
  productImageUrl: vi.fn(() => null),
}))

vi.mock('./lib/supabase', () => ({ supabase: null }))

const categories: Category[] = [
  { id: 'chicken', name: 'Ayam', description: '', sort_order: 0, is_active: true, archived_at: null },
  { id: 'drink', name: 'Minuman', description: '', sort_order: 1, is_active: true, archived_at: null },
]
const products: Product[] = [
  { id: 'available', name: 'Ayam Original', description: 'Ayam renyah', price: 12000, category_id: 'chicken', image_path: null, is_available: true, is_published: true, sort_order: 0, archived_at: null },
  { id: 'soldout', name: 'Ayam Pedas', description: '', price: 14000, category_id: 'chicken', image_path: null, is_available: false, is_published: true, sort_order: 1, archived_at: null },
  { id: 'tea', name: 'Es Teh', description: '', price: 4000, category_id: 'drink', image_path: null, is_available: true, is_published: true, sort_order: 2, archived_at: null },
]

function renderApp() {
  return render(<HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></HashRouter>)
}

describe('customer and protected admin surfaces', () => {
  beforeEach(() => {
    window.location.hash = '#/'
    localStorage.clear()
    getCatalog.mockResolvedValue({ categories, products })
    getStoreSettings.mockResolvedValue({
      id: 1, store_name: 'Rocket Chicken', branch_name: 'KS Tubun Purwokerto', whatsapp_number: '6281234567890',
      contact_information: '', address: '', opening_hours: '', takeaway_enabled: true,
      delivery_enabled: true, delivery_address_required: true, delivery_fee: 0,
      customer_phone_required: false, public_information: '',
    })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })

  it('searches products, filters categories, and prevents adding sold-out products', async () => {
    renderApp()
    expect(await screen.findByText('Ayam Original')).toBeInTheDocument()
    expect(screen.getAllByText('KS Tubun Purwokerto').length).toBeGreaterThan(1)
    expect(document.title).toBe('Rocket Chicken KS Tubun Purwokerto | Menu & Pemesanan')
    expect(screen.getByText('Ayam Pedas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ayam Pedas sedang habis' })).toBeDisabled()

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari produk' }), { target: { value: 'teh' } })
    expect(screen.getByText('Es Teh')).toBeInTheDocument()
    expect(screen.queryByText('Ayam Original')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Cari produk' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^Ayam$/ }))
    expect(screen.getByText('Ayam Original')).toBeInTheDocument()
    expect(screen.queryByText('Es Teh')).not.toBeInTheDocument()
  })

  it('shows a useful catalog error rather than a blank page', async () => {
    getCatalog.mockRejectedValueOnce(new Error('Konfigurasi Supabase belum tersedia.'))
    renderApp()
    await waitFor(() => expect(screen.getByText('Menu belum dapat dimuat')).toBeInTheDocument())
    expect(screen.getByText('Konfigurasi Supabase belum tersedia.')).toBeInTheDocument()
  })

  it('shows the login screen instead of admin data for an unauthenticated visitor', async () => {
    window.location.hash = '#/admin'
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Masuk admin' })).toBeInTheDocument()
    expect(screen.queryByText('Ringkasan')).not.toBeInTheDocument()
  })

  it('prevents empty-cart checkout', async () => {
    renderApp()
    await screen.findByText('Ayam Original')
    fireEvent.click(screen.getByRole('button', { name: 'Keranjang, 0 item' }))
    expect(screen.getByText('Keranjang masih kosong')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Lanjut pesan/ })).not.toBeInTheDocument()
  })

  it('uses refreshed prices and ignores duplicate checkout submissions', async () => {
    let requestCount = 0
    getCatalog.mockImplementation(async () => {
      requestCount += 1
      const refreshedProducts = requestCount >= 3
        ? products.map((product) => product.id === 'available' ? { ...product, price: 15000 } : product)
        : products
      return { categories, products: refreshedProducts }
    })
    const popup = { opener: null, location: { href: '' }, close: vi.fn() } as unknown as Window
    vi.spyOn(window, 'open').mockReturnValue(popup)
    renderApp()
    await screen.findByText('Ayam Original')
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Ayam Original ke keranjang' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keranjang, 1 item' }))
    fireEvent.click(screen.getByRole('button', { name: /Lanjut pesan/ }))
    const nameInput = await screen.findByLabelText('Nama lengkap')
    fireEvent.change(nameInput, { target: { value: 'Dina' } })
    const checkoutForm = nameInput.closest('form')
    expect(checkoutForm).not.toBeNull()
    fireEvent.submit(checkoutForm!)
    fireEvent.submit(checkoutForm!)
    expect(await screen.findByText('Pesan siap dilanjutkan di WhatsApp')).toBeInTheDocument()
    expect((screen.getByRole('textbox', { name: 'Pesan pesanan WhatsApp' }) as HTMLTextAreaElement).value).toContain('Rp 15.000')
    expect(window.open).toHaveBeenCalledTimes(1)
  }, 30000)
})
