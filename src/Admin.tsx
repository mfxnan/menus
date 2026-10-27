import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, ImagePlus, LogOut, Package, Plus, Settings2, Tags, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { archiveCategory, archiveProduct, bulkCategories, bulkProducts, getAdminData, productImageUrl, saveCategory, saveProduct, saveSettings, uploadProductImage } from './lib/data'
import { supabase } from './lib/supabase'
import { normalizeWhatsAppNumber } from './lib/whatsapp'
import { validateCategory, validateProduct } from './lib/validation'
import { formatIDR } from './lib/money'
import type { Category, Product, StoreSettings } from './types'
import './admin-bulk.css'

type AdminData = { categories: Category[]; products: Product[]; settings: StoreSettings }
type Notice = { kind: 'success' | 'error'; text: string }

function storeInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'RC'
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [authError, setAuthError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    let active = true
    void supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return
      if (error) setAuthError(error.message)
      setSession(result.session)
      setAuthLoading(Boolean(result.session))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) { setSession(nextSession); setAuthError('') }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session || !supabase) { setAdmin(false); return }
    setAuthLoading(true)
    let active = true
    void supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(({ data: profile, error }) => {
      if (!active) return
      if (error) setAuthError(`Tidak dapat memeriksa izin administrator: ${error.message}`)
      setAdmin(profile?.role === 'admin')
      setAuthLoading(false)
    })
    return () => { active = false }
  }, [session])

  const reload = async () => {
    setDataLoading(true)
    try { setData(await getAdminData()) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Data admin gagal dimuat.' }) }
    finally { setDataLoading(false) }
  }
  useEffect(() => { if (admin) void reload() }, [admin])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setAuthError('Konfigurasi Supabase belum tersedia. Isi .env.local terlebih dahulu.'); return }
    setAuthLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setAuthLoading(false)
    if (error) setAuthError('Login gagal. Periksa email, kata sandi, dan status administrator.')
    else setPassword('')
  }

  const logout = async () => {
    const { error } = await supabase!.auth.signOut()
    if (error) setNotice({ kind: 'error', text: `Gagal keluar: ${error.message}` })
    else { setData(null); setNotice(null) }
  }

  if (authLoading) return <div className="admin-loading"><span className="spinner" /><p>Memeriksa sesi administrator...</p></div>
  if (!session) return <div className="login-page"><Link to="/" className="admin-back"><ArrowLeft size={17} /> Kembali ke menu</Link><form className="login-card" onSubmit={login}><div className="brand-mark large">RC</div><span className="eyebrow red">AREA KHUSUS</span><h1>Masuk admin</h1><p>Kelola menu dan informasi gerai.</p><label>Email administrator<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@contoh.id" /></label><label>Kata sandi<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{authError && <p className="form-error" role="alert">{authError}</p>}<button className="primary-button full-button" disabled={authLoading}>Masuk <ChevronRight size={17} /></button><small>Akun admin dibuat melalui Supabase, tidak ada pendaftaran publik.</small></form></div>
  if (!admin) return <div className="login-page"><div className="login-card"><div className="brand-mark large">RC</div><h1>Akses tidak diizinkan</h1><p>Akun ini tidak memiliki peran administrator.</p>{authError && <p className="form-error">{authError}</p>}<button className="secondary-button" onClick={() => void logout()}>Keluar</button></div></div>
  if (!data) return <div className="admin-loading"><span className="spinner" /><p>{dataLoading ? 'Memuat data dashboard...' : notice?.text || 'Menghubungkan dashboard...'}</p>{!dataLoading && <button className="secondary-button" onClick={() => void reload()}>Coba lagi</button>}</div>

  const shared = { data, setData, reload, notice, setNotice }
  return <div className="admin-shell">
    <aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><span className="brand-mark">{storeInitials(data.settings.store_name)}</span><span><strong>{data.settings.store_name}</strong><small>ADMIN · {data.settings.branch_name}</small></span></Link><nav><span className="nav-label">WORKSPACE</span><Link to="/admin"><Package size={18} /> Ringkasan</Link><Link to="/admin/products"><Package size={18} /> Produk</Link><Link to="/admin/categories"><Tags size={18} /> Kategori</Link><Link to="/admin/settings"><Settings2 size={18} /> Pengaturan</Link></nav><div className="sidebar-bottom"><Link to="/" className="public-link"><ArrowLeft size={16} /> Lihat menu publik</Link><button onClick={() => void logout()}><LogOut size={17} /> Keluar</button></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="eyebrow red">PANEL ADMIN</span><h1>{data.settings.store_name} <span>{data.settings.branch_name}</span></h1></div><div className="admin-user"><span className="admin-avatar">{session.user.email?.slice(0, 1).toUpperCase()}</span><span>{session.user.email}</span></div></header>
      {notice && <div className={notice.kind === 'error' ? 'notice error' : 'notice success'} role="status"><span>{notice.kind === 'error' ? '!' : <Check size={16} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Tutup notifikasi"><X size={16} /></button></div>}
      {dataLoading && <div className="inline-loading"><span className="spinner small" /> Memperbarui data...</div>}
      <Routes>
        <Route index element={<Dashboard data={data} />} />
        <Route path="products" element={<ProductsPage {...shared} />} />
        <Route path="categories" element={<CategoriesPage {...shared} />} />
        <Route path="settings" element={<SettingsPage {...shared} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </main>
  </div>
}

function Dashboard({ data }: { data: AdminData }) {
  const active = data.products.filter((product) => !product.archived_at && product.is_published).length
  const unavailable = data.products.filter((product) => !product.archived_at && !product.is_available).length
  const categories = data.categories.filter((category) => !category.archived_at).length
  return <section className="admin-content"><div className="admin-page-heading"><div><h2>Ringkasan</h2><p>Kelola menu dan informasi publik gerai Anda.</p></div></div><div className="stats-grid"><div className="stat-card"><span>PRODUK AKTIF</span><strong>{active}</strong><small>Menu dipublikasikan</small></div><div className="stat-card"><span>KATEGORI</span><strong>{categories}</strong><small>Kategori tidak diarsipkan</small></div><div className="stat-card"><span>PRODUK HABIS</span><strong>{unavailable}</strong><small>Perlu diperbarui bila tersedia</small></div></div><div className="dashboard-columns"><div className="admin-card"><h3>Akses cepat</h3><p>Perbarui katalog dan informasi yang dilihat pelanggan.</p><div className="shortcut-list"><Link to="/admin/products"><span className="shortcut-icon"><Package size={19} /></span><span><strong>Kelola produk</strong><small>Harga, ketersediaan, foto, dan publikasi</small></span><ChevronRight /></Link><Link to="/admin/categories"><span className="shortcut-icon"><Tags size={19} /></span><span><strong>Atur kategori</strong><small>Nama, visibilitas, dan urutan menu</small></span><ChevronRight /></Link><Link to="/admin/settings"><span className="shortcut-icon"><Settings2 size={19} /></span><span><strong>Pengaturan gerai</strong><small>Nomor WhatsApp, alamat, dan layanan</small></span><ChevronRight /></Link></div></div><div className="admin-card store-summary"><span className="eyebrow red">INFO PUBLIK</span><h3>{data.settings.store_name} · {data.settings.branch_name}</h3><p>{data.settings.address || data.settings.branch_name}</p><div><span>Nomor WhatsApp</span><strong>{data.settings.whatsapp_number || 'Belum diatur'}</strong></div><div><span>Antar</span><strong>{data.settings.delivery_enabled ? 'Aktif' : 'Nonaktif'}</strong></div><div><span>Ambil sendiri</span><strong>{data.settings.takeaway_enabled ? 'Aktif' : 'Nonaktif'}</strong></div></div></div></section>
}

type BulkAction = 'archive' | 'deactivate' | 'delete'

function BulkActions({ selectedCount, visibleCount, allVisibleSelected, busy, onSelectAll, onClear, onAction }: {
  selectedCount: number
  visibleCount: number
  allVisibleSelected: boolean
  busy: boolean
  onSelectAll: () => void
  onClear: () => void
  onAction: (action: BulkAction) => void
}) {
  return <div className="bulk-toolbar" aria-label="Aksi batch">
    <div className="bulk-selection-actions">
      <button className="secondary-button compact" type="button" onClick={onSelectAll} disabled={busy || !visibleCount || allVisibleSelected}>Pilih semua hasil ({visibleCount})</button>
      <button className="secondary-button compact" type="button" onClick={onClear} disabled={busy || !selectedCount}>Batalkan pilihan</button>
      <span>{selectedCount} dipilih</span>
    </div>
    <div className="bulk-action-buttons">
      <button className="secondary-button compact" type="button" onClick={() => onAction('archive')} disabled={busy || !selectedCount}>Arsipkan</button>
      <button className="secondary-button compact" type="button" onClick={() => onAction('deactivate')} disabled={busy || !selectedCount}>Nonaktifkan</button>
      <button className="secondary-button compact danger-text" type="button" onClick={() => onAction('delete')} disabled={busy || !selectedCount}>Hapus</button>
    </div>
  </div>
}

function ProductsPage({ data, setData, reload, setNotice }: { data: AdminData; setData: (data: AdminData) => void; reload: () => Promise<void>; setNotice: (notice: Notice | null) => void }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const filtered = data.products.filter((product) => `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase()))
  const visibleIds = filtered.map((product) => product.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const update = (product: Product) => setData({ ...data, products: data.products.map((entry) => entry.id === product.id ? product : entry) })
  const runBulkAction = async (action: BulkAction) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const actionLabel = action === 'delete' ? 'Hapus' : action === 'archive' ? 'Arsipkan' : 'Nonaktifkan'
    if (!window.confirm(`${actionLabel} ${ids.length} produk terpilih?`)) return
    setBusy(true)
    try {
      await bulkProducts(ids, action)
      setSelectedIds(new Set())
      setNotice({ kind: 'success', text: `${ids.length} produk berhasil ${action === 'delete' ? 'dihapus' : action === 'archive' ? 'diarsipkan' : 'dinonaktifkan'}.` })
      await reload()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Aksi batch produk gagal.' })
    } finally { setBusy(false) }
  }
  const archive = async (product: Product) => {
    if (!window.confirm(`Arsipkan "${product.name}"? Produk tidak akan tampil di menu publik.`)) return
    try { await archiveProduct(product.id); setNotice({ kind: 'success', text: 'Produk berhasil diarsipkan.' }); await reload() }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Produk gagal diarsipkan.' }) }
  }
  const toggle = async (product: Product, field: 'is_available' | 'is_published') => {
    try { await saveProduct({ ...product, [field]: !product[field] }); update({ ...product, [field]: !product[field] }); setNotice({ kind: 'success', text: 'Status produk diperbarui.' }) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Status gagal diperbarui.' }) }
  }
  return <section className="admin-content"><div className="admin-page-heading"><div><h2>Produk</h2><p>{data.products.length} produk dalam katalog.</p></div><button className="primary-button" onClick={() => setEditing('new')}><Plus size={17} /> Tambah produk</button></div><div className="admin-toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari produk..." aria-label="Cari produk" /></div>
    <BulkActions selectedCount={selectedIds.size} visibleCount={filtered.length} allVisibleSelected={allVisibleSelected} busy={busy} onSelectAll={() => setSelectedIds((current) => new Set([...current, ...visibleIds]))} onClear={() => setSelectedIds(new Set())} onAction={(action) => void runBulkAction(action)} />
    <div className="product-admin-list">{filtered.map((product) => <article className={product.archived_at ? 'product-admin-row archived' : 'product-admin-row'} key={product.id}><div className="admin-product-image">{product.image_path ? <img src={productImageUrl(product.image_path) ?? undefined} alt="" /> : <ImagePlus />}</div><div className="admin-product-info"><strong>{product.name}</strong><span>{data.categories.find((category) => category.id === product.category_id)?.name ?? 'Kategori tidak ditemukan'}</span></div><strong className="admin-product-price">{formatIDR(product.price)}</strong><span className={product.is_available ? 'status-pill available' : 'status-pill unavailable'}>{product.is_available ? 'Tersedia' : 'Habis'}</span><div className="row-actions"><label className="bulk-row-select"><input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelected(product.id)} disabled={busy} aria-label={`Pilih ${product.name}`} /> Pilih</label><button className="secondary-button compact" onClick={() => setEditing(product)}>Edit</button><button className="secondary-button compact" onClick={() => void toggle(product, 'is_available')}>{product.is_available ? 'Tandai habis' : 'Tersedia'}</button><button className="secondary-button compact" onClick={() => void toggle(product, 'is_published')}>{product.is_published ? 'Unpublish' : 'Publish'}</button>{!product.archived_at && <button className="icon-button danger-text" onClick={() => void archive(product)} aria-label={`Arsipkan ${product.name}`}><X size={17} /></button>}</div></article>)}{!filtered.length && <div className="state-card">Tidak ada produk yang cocok.</div>}</div>
    {editing !== null && <ProductEditor product={editing === 'new' ? null : editing} categories={data.categories.filter((category) => !category.archived_at)} busy={busy} setBusy={setBusy} onClose={() => setEditing(null)} onSave={async (product) => { try { await saveProduct(product); setNotice({ kind: 'success', text: product.id ? 'Produk berhasil diperbarui.' : 'Produk berhasil ditambahkan.' }); setEditing(null); await reload() } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Produk gagal disimpan.' }) } }} />}
  </section>
}

function ProductEditor({ product, categories, busy, setBusy, onClose, onSave }: { product: Product | null; categories: Category[]; busy: boolean; setBusy: (busy: boolean) => void; onClose: () => void; onSave: (product: Partial<Product> & Pick<Product, 'name' | 'price' | 'category_id'>) => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '')
  const [order, setOrder] = useState(String(product?.sort_order ?? 0))
  const [available, setAvailable] = useState(product?.is_available ?? true)
  const [published, setPublished] = useState(product?.is_published ?? true)
  const imagePath = product?.image_path ?? null
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(product?.image_path ? productImageUrl(product.image_path) : product?.image_url ?? null)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericPrice = Number(price)
    const validationError = validateProduct({ name, price: numericPrice, category_id: categoryId })
    if (validationError) { setError(validationError); return }
    if (!Number.isSafeInteger(Number(order))) { setError('Urutan tampil harus berupa bilangan bulat.'); return }
    setBusy(true); setError('')
    try {
      const uploaded = imageFile ? await uploadProductImage(imageFile) : imagePath
      await onSave({ ...(product ? { id: product.id } : {}), name: name.trim(), description: description.trim(), price: numericPrice, category_id: categoryId, sort_order: Number(order) || 0, is_available: available, is_published: published, image_path: uploaded, archived_at: product?.archived_at ?? null })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Gagal menyimpan produk.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><form className="admin-modal" onSubmit={submit}><div className="panel-heading"><div><span className="eyebrow red">{product ? 'PERBARUI KATALOG' : 'KATALOG BARU'}</span><h2>{product ? 'Edit produk' : 'Tambah produk'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Tutup"><X /></button></div><div className="admin-form-grid"><label>Nama produk<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label><label>Harga (Rupiah)<input required type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>Kategori<select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Urutan tampil<input type="number" step="1" value={order} onChange={(e) => setOrder(e.target.value)} /></label><label className="form-span">Deskripsi<textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></label><label className="upload-control form-span">Foto produk<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] ?? null; setImageFile(file); setPreview(file ? URL.createObjectURL(file) : (imagePath ? productImageUrl(imagePath) : null)) }} /><span>JPG, PNG, atau WebP. Pilih foto baru untuk mengganti gambar saat ini.</span>{preview && <img src={preview} alt="Pratinjau produk" />}</label><div className="toggle-row form-span"><label><input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> Tersedia</label><label><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Tampilkan di menu publik</label></div></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan produk'}</button></div></form></div>
}

function CategoriesPage({ data, reload, setNotice }: { data: AdminData; reload: () => Promise<void>; setNotice: (notice: Notice | null) => void }) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const ordered = useMemo(() => [...data.categories].sort((a, b) => a.sort_order - b.sort_order), [data.categories])
  const filtered = ordered.filter((category) => `${category.name} ${category.description}`.toLowerCase().includes(filter.toLowerCase()))
  const visibleIds = filtered.map((category) => category.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const open = (category: Category | 'new') => { setEditing(category); setName(category === 'new' ? '' : category.name); setDescription(category === 'new' ? '' : category.description) }
  const persist = async (category: Category, order: number) => { await saveCategory({ ...category, sort_order: order }) }
  const move = async (category: Category, direction: -1 | 1) => {
    const current = ordered.findIndex((entry) => entry.id === category.id)
    const next = current + direction
    if (next < 0 || next >= ordered.length) return
    const neighbor = ordered[next]
    try { await Promise.all([persist(category, neighbor.sort_order), persist(neighbor, category.sort_order)]); setNotice({ kind: 'success', text: 'Urutan kategori diperbarui.' }); await reload() }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Urutan kategori gagal disimpan.' }) }
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const issue = validateCategory(name)
    if (issue) { setNotice({ kind: 'error', text: issue }); return }
    const current = editing === 'new' ? undefined : editing
    try { await saveCategory({ ...(current ? { id: current.id } : {}), name: name.trim(), description: description.trim(), sort_order: current?.sort_order ?? data.categories.length, is_active: current?.is_active ?? true, archived_at: current?.archived_at ?? null }); setNotice({ kind: 'success', text: current ? 'Kategori diperbarui.' : 'Kategori ditambahkan.' }); setEditing(null); await reload() }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal disimpan.' }) }
  }
  const archive = async (category: Category) => {
    if (!window.confirm(`Arsipkan kategori "${category.name}"?`)) return
    try { await archiveCategory(category.id); setNotice({ kind: 'success', text: 'Kategori berhasil diarsipkan.' }); await reload() }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal diarsipkan.' }) }
  }
  const changeActive = async (category: Category) => {
    try { await saveCategory({ ...category, is_active: !category.is_active }); setNotice({ kind: 'success', text: 'Visibilitas kategori diperbarui.' }); await reload() }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal diperbarui.' }) }
  }
  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const runBulkAction = async (action: BulkAction) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    const actionLabel = action === 'delete' ? 'Hapus' : action === 'archive' ? 'Arsipkan' : 'Nonaktifkan'
    if (!window.confirm(`${actionLabel} ${ids.length} kategori terpilih?`)) return
    setBulkBusy(true)
    try {
      await bulkCategories(ids, action)
      setSelectedIds(new Set())
      setNotice({ kind: 'success', text: `${ids.length} kategori berhasil ${action === 'delete' ? 'dihapus' : action === 'archive' ? 'diarsipkan' : 'dinonaktifkan'}.` })
      await reload()
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Aksi batch kategori gagal.' })
    } finally { setBulkBusy(false) }
  }
  return <section className="admin-content"><div className="admin-page-heading"><div><h2>Kategori menu</h2><p>{data.categories.length} kategori, dapat diubah tanpa mengedit kode.</p></div><button className="primary-button" onClick={() => open('new')}><Plus size={17} /> Tambah kategori</button></div><input className="admin-search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari kategori..." aria-label="Cari kategori..." />
    <BulkActions selectedCount={selectedIds.size} visibleCount={filtered.length} allVisibleSelected={allVisibleSelected} busy={bulkBusy} onSelectAll={() => setSelectedIds((current) => new Set([...current, ...visibleIds]))} onClear={() => setSelectedIds(new Set())} onAction={(action) => void runBulkAction(action)} />
    <div className="category-admin-list">{filtered.map((category) => <article className="category-admin-row" key={category.id}><div className="category-order"><button className="icon-button" onClick={() => void move(category, -1)} aria-label={`Pindahkan ${category.name} ke atas`}><ArrowUp size={17} /></button><span>{category.sort_order}</span><button className="icon-button" onClick={() => void move(category, 1)} aria-label={`Pindahkan ${category.name} ke bawah`}><ArrowDown size={17} /></button></div><div className="category-admin-info"><strong>{category.name}</strong><small>{category.description || 'Tanpa deskripsi'} · {data.products.filter((product) => product.category_id === category.id && !product.archived_at).length} produk</small></div><span className={category.is_active ? 'status-pill available' : 'status-pill unavailable'}>{category.is_active ? 'Tampil' : 'Disembunyikan'}</span><div className="row-actions"><label className="bulk-row-select"><input type="checkbox" checked={selectedIds.has(category.id)} onChange={() => toggleSelected(category.id)} disabled={bulkBusy} aria-label={`Pilih kategori ${category.name}`} /> Pilih</label><button className="secondary-button compact" onClick={() => open(category)}>Edit</button><button className="secondary-button compact" onClick={() => void changeActive(category)}>{category.is_active ? 'Sembunyikan' : 'Tampilkan'}</button><button className="secondary-button compact danger-text" onClick={() => void archive(category)}>Arsipkan</button></div></article>)}</div>{editing && <div className="modal-backdrop"><form className="admin-modal small-modal" onSubmit={save}><div className="panel-heading"><h2>{editing === 'new' ? 'Kategori baru' : 'Edit kategori'}</h2><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Tutup"><X /></button></div><label>Nama kategori<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label><label>Deskripsi (opsional)<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Batal</button><button className="primary-button">Simpan</button></div></form></div>}</section>
}

function SettingsPage({ data, reload, setNotice }: { data: AdminData; reload: () => Promise<void>; setNotice: (notice: Notice | null) => void }) {
  const [settings, setSettings] = useState(data.settings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const phone = normalizeWhatsAppNumber(settings.whatsapp_number)
    if (!/^62\d{8,13}$/.test(phone)) { setError('Nomor WhatsApp wajib valid dan menggunakan kode negara Indonesia 62, contoh: 6281234567890.'); return }
    if (!settings.takeaway_enabled && !settings.delivery_enabled) { setError('Aktifkan minimal satu jenis layanan pesanan.'); return }
    if (!Number.isSafeInteger(settings.delivery_fee) || settings.delivery_fee < 0) { setError('Biaya antar harus berupa angka Rupiah bulat dan tidak negatif.'); return }
    setBusy(true)
    try { await saveSettings({ ...settings, whatsapp_number: phone }); setNotice({ kind: 'success', text: 'Pengaturan gerai berhasil disimpan.' }); await reload() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Pengaturan gagal disimpan.') }
    finally { setBusy(false) }
  }
  return <section className="admin-content"><div className="admin-page-heading"><div><h2>Pengaturan gerai</h2><p>Informasi ini ditampilkan di menu publik dan pesan WhatsApp.</p></div></div><form className="settings-form admin-card" onSubmit={submit}><div className="settings-section"><h3>Informasi gerai</h3><div className="admin-form-grid"><label>Nama outlet<input required maxLength={120} value={settings.store_name} onChange={(e) => update('store_name', e.target.value)} placeholder="Rocket Chicken" /></label><label>Cabang / lokasi singkat<input required maxLength={120} value={settings.branch_name} onChange={(e) => update('branch_name', e.target.value)} placeholder="KS Tubun Purwokerto" /></label><label>Nomor WhatsApp toko<input required inputMode="tel" value={settings.whatsapp_number} onChange={(e) => update('whatsapp_number', e.target.value)} placeholder="6281234567890" /><small>Gunakan digit internasional: 62 diikuti nomor tanpa +, spasi, atau tanda hubung. Contoh 6281234567890.</small></label><label>Kontak publik<input value={settings.contact_information} onChange={(e) => update('contact_information', e.target.value)} placeholder="Informasi telepon atau kontak gerai" /></label><label>Alamat lengkap gerai<input value={settings.address} onChange={(e) => update('address', e.target.value)} /></label><label>Jam operasional<input value={settings.opening_hours} onChange={(e) => update('opening_hours', e.target.value)} placeholder="Setiap hari, 10.00–22.00" /></label><label>Informasi publik<textarea rows={2} value={settings.public_information} onChange={(e) => update('public_information', e.target.value)} /></label></div></div><div className="settings-section"><h3>Layanan pesanan</h3><div className="toggle-row"><label><input type="checkbox" checked={settings.takeaway_enabled} onChange={(e) => update('takeaway_enabled', e.target.checked)} /> Ambil sendiri (takeaway)</label><label><input type="checkbox" checked={settings.delivery_enabled} onChange={(e) => update('delivery_enabled', e.target.checked)} /> Pengantaran (delivery)</label><label><input type="checkbox" checked={settings.delivery_address_required} onChange={(e) => update('delivery_address_required', e.target.checked)} /> Wajibkan alamat pengantaran</label><label><input type="checkbox" checked={settings.customer_phone_required} onChange={(e) => update('customer_phone_required', e.target.checked)} /> Wajibkan nomor WhatsApp pelanggan</label></div><label className="delivery-fee">Biaya antar (Rupiah)<input type="number" min="0" step="1" value={settings.delivery_fee} onChange={(e) => update('delivery_fee', Number(e.target.value))} /><small>Biaya hanya ditambahkan pada pesanan delivery.</small></label></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan pengaturan'} <Check size={17} /></button></div></form></section>
}
