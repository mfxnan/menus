import { describe, expect, it } from 'vitest'
import { validateCategory, validateProduct } from './validation'

describe('admin form validation', () => {
  it('requires product name/category and integer nonnegative price', () => {
    expect(validateProduct({ name: '', price: 0, category_id: 'cat' })).toMatch(/Nama/)
    expect(validateProduct({ name: 'Ayam', price: 10.25, category_id: 'cat' })).toMatch(/Harga/)
    expect(validateProduct({ name: 'Ayam', price: -1, category_id: 'cat' })).toMatch(/Harga/)
    expect(validateProduct({ name: 'Ayam', price: Number.NaN, category_id: 'cat' })).toMatch(/Harga/)
    expect(validateProduct({ name: 'Ayam', price: 10000, category_id: '' })).toMatch(/Kategori/)
    expect(validateProduct({ name: ' Ayam ', price: 10000, category_id: 'cat' })).toBeNull()
  })

  it('requires a category name with a bounded length', () => {
    expect(validateCategory('  ')).toMatch(/Nama/)
    expect(validateCategory('A'.repeat(81))).toMatch(/80/)
    expect(validateCategory('Menu')).toBeNull()
  })
})
