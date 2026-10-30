import type { Category, Product, StoreSettings } from '../types'
import { defaultSettings } from '../types'
import { supabase } from './supabase'
import { compressProductImage } from './image'

function requireClient() {
  if (!supabase) throw new Error('Koneksi Supabase belum dikonfigurasi.')
  return supabase
}

export async function getCatalog(): Promise<{ categories: Category[]; products: Product[] }> {
  const client = requireClient()
  const [categoryResult, productResult] = await Promise.all([
    client.from('categories').select('*').eq('is_active', true).is('archived_at', null).order('sort_order'),
    client.from('products').select('*').eq('is_published', true).is('archived_at', null).order('sort_order'),
  ])
  if (categoryResult.error) throw categoryResult.error
  if (productResult.error) throw productResult.error
  const products = (productResult.data as Product[]).map((product) => ({
    ...product,
    image_url: product.image_path ? client.storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl : product.image_url,
  }))
  return { categories: categoryResult.data as Category[], products }
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await requireClient().from('store_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data ? { ...defaultSettings, ...(data as StoreSettings) } : defaultSettings
}

export async function getAdminData() {
  const client = requireClient()
  const [categoryResult, productResult, settingsResult] = await Promise.all([
    client.from('categories').select('*').order('sort_order'),
    client.from('products').select('*').order('sort_order'),
    client.from('store_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (categoryResult.error) throw categoryResult.error
  if (productResult.error) throw productResult.error
  if (settingsResult.error) throw settingsResult.error
  return {
    categories: categoryResult.data as Category[],
    products: productResult.data as Product[],
    settings: settingsResult.data ? { ...defaultSettings, ...(settingsResult.data as StoreSettings) } : defaultSettings,
  }
}

export async function saveProduct(product: Partial<Product> & Pick<Product, 'name' | 'price' | 'category_id'>) {
  const { id, ...values } = product
  const client = requireClient()
  let previousImagePath: string | null = null
  if (id) {
    const { data: previous, error: previousError } = await client.from('products').select('image_path').eq('id', id).maybeSingle()
    if (previousError) throw previousError
    previousImagePath = previous?.image_path ?? null
  }
  const { data, error } = id
    ? await client.from('products').update(values).eq('id', id).select().single()
    : await client.from('products').insert(values).select().single()
  if (error) throw error
  const productData = data as Product
  let warning: string | null = null
  if (previousImagePath && previousImagePath !== productData.image_path) {
    const { data: references, error: referenceError } = await client.from('products').select('id').eq('image_path', previousImagePath).limit(1)
    if (referenceError) {
      warning = 'foto lama belum dapat dibersihkan dari penyimpanan.'
    } else if (!references?.length) {
      const { error: removeError } = await client.storage.from('product-images').remove([previousImagePath])
      if (removeError) warning = 'foto lama belum dapat dibersihkan dari penyimpanan.'
    }
  }
  return { product: productData, warning }
}

export async function archiveProduct(id: string) {
  const { error } = await requireClient().from('products').update({ archived_at: new Date().toISOString(), is_available: false, is_published: false }).eq('id', id)
  if (error) throw error
}

export async function bulkProducts(ids: string[], action: 'archive' | 'deactivate' | 'delete'): Promise<string | null> {
  if (!ids.length) return null
  const client = requireClient()
  if (action === 'delete') {
    const { data: products, error: selectError } = await client.from('products').select('image_path').in('id', ids)
    if (selectError) throw selectError
    const { error } = await client.from('products').delete().in('id', ids)
    if (error) throw error
    const paths = [...new Set((products ?? []).map(({ image_path }) => image_path).filter((path): path is string => Boolean(path)))]
    if (!paths.length) return null
    const { data: remaining, error: remainingError } = await client.from('products').select('image_path').in('image_path', paths)
    if (remainingError) return 'produk terhapus, tetapi status pembersihan foto tidak dapat diperiksa.'
    const referencedPaths = new Set((remaining ?? []).map(({ image_path }) => image_path))
    const orphanedPaths = paths.filter((path) => !referencedPaths.has(path))
    if (!orphanedPaths.length) return null
    const { error: removeError } = await client.storage.from('product-images').remove(orphanedPaths)
    return removeError ? 'produk terhapus, tetapi sebagian foto lama belum dapat dibersihkan.' : null
  }
  const query = client.from('products')
  const result = await query.update(action === 'archive'
      ? { archived_at: new Date().toISOString(), is_available: false, is_published: false }
      : { is_available: false, is_published: false }).in('id', ids)
  if (result.error) throw result.error
  return null
}

export async function saveCategory(category: Partial<Category> & Pick<Category, 'name'>) {
  const { id, ...values } = category
  const { data, error } = id
    ? await requireClient().from('categories').update(values).eq('id', id).select().single()
    : await requireClient().from('categories').insert(values).select().single()
  if (error) throw error
  return data as Category
}

export async function archiveCategory(id: string) {
  const { count, error: countError } = await requireClient().from('products').select('id', { count: 'exact', head: true }).eq('category_id', id).is('archived_at', null)
  if (countError) throw countError
  if (count && count > 0) throw new Error('Kategori masih digunakan produk. Pindahkan produk terlebih dahulu.')
  const { error } = await requireClient().from('categories').update({ archived_at: new Date().toISOString(), is_active: false }).eq('id', id)
  if (error) throw error
}

export async function bulkCategories(ids: string[], action: 'archive' | 'deactivate' | 'delete') {
  if (!ids.length) return
  const client = requireClient()
  if (action === 'archive') {
    const { data, error } = await client.from('products').select('category_id').in('category_id', ids).is('archived_at', null)
    if (error) throw error
    if (data?.length) throw new Error('Kategori masih digunakan produk. Pindahkan produk terlebih dahulu.')
  }
  const query = client.from('categories')
  const result = action === 'delete'
    ? await query.delete().in('id', ids)
    : await query.update(action === 'archive'
      ? { archived_at: new Date().toISOString(), is_active: false }
      : { is_active: false }).in('id', ids)
  if (result.error) throw result.error
}

export async function saveSettings(settings: StoreSettings) {
  const { error } = await requireClient().from('store_settings').upsert(settings)
  if (error) throw error
}

export async function uploadProductImage(file: File): Promise<string> {
  const client = requireClient()
  const compressed = await compressProductImage(file)
  const extension = compressed.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('product-images').upload(path, compressed, { upsert: false, contentType: compressed.type })
  if (error) throw error
  return path
}

export async function removeProductImage(path: string): Promise<void> {
  const { error } = await requireClient().storage.from('product-images').remove([path])
  if (error) throw error
}

export function productImageUrl(path: string | null): string | null {
  if (!path) return null
  const client = requireClient()
  return client.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
