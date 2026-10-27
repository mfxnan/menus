import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, Clock3, MapPin, Menu as MenuIcon, Minus, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { Admin } from './Admin'
import { getCatalog, getStoreSettings } from './lib/data'
import { cartCount, cartTotal, loadCart, saveCart, setQuantity, validCartItems } from './lib/cart'
import { formatIDR } from './lib/money'
import { buildWhatsAppMessage, buildWhatsAppUrl } from './lib/whatsapp'
import { validateCheckout } from './lib/validation'
import { supabase } from './lib/supabase'
import type { CartItem, Category, CheckoutDetails, Product, StoreSettings } from './types'
import { defaultSettings } from './types'

const initialDetails: CheckoutDetails = { customerName: '', customerPhone: '', orderType: 'takeaway', address: '', notes: '' }

function storeInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'RC'
}

export function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings)
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [details, setDetails] = useState<CheckoutDetails>(initialDetails)
  const [checkoutError, setCheckoutError] = useState('')
  const [preparedMessage, setPreparedMessage] = useState('')
  const [preparing, setPreparing] = useState(false)
  const checkoutLock = useRef(false)
  const [copied, setCopied] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const refreshCatalog = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [catalog, store] = await Promise.all([getCatalog(), getStoreSettings()])
      setCategories(catalog.categories)
      setProducts(catalog.products)
      setSettings(store)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Menu gagal dimuat. Silakan coba kembali.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCatalog()
    const refresh = () => { void refreshCatalog() }
    window.addEventListener('focus', refresh)
    const poll = window.setInterval(refresh, 60_000)
    const channel = supabase?.channel('public-menu-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, refresh)
      .subscribe()
    return () => {
      window.removeEventListener('focus', refresh)
      window.clearInterval(poll)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [refreshCatalog])

  useEffect(() => saveCart(cart), [cart])

  useEffect(() => {
    document.title = `${settings.store_name} ${settings.branch_name} | Menu & Pemesanan`
  }, [settings.branch_name, settings.store_name])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    return products.filter((product) => {
      const matchesCategory = categoryId === 'all' || product.category_id === categoryId
      const matchesQuery = !query || `${product.name} ${product.description}`.toLocaleLowerCase('id-ID').includes(query)
      return matchesCategory && matchesQuery
    })
  }, [categoryId, products, search])
  const count = cartCount(cart)
  const subtotal = cartTotal(cart, products)
  const deliveryFee = details.orderType === 'delivery' ? settings.delivery_fee : 0

  useEffect(() => {
    setDetails((current) => {
      if (current.orderType === 'takeaway' && !settings.takeaway_enabled && settings.delivery_enabled) return { ...current, orderType: 'delivery' }
      if (current.orderType === 'delivery' && !settings.delivery_enabled && settings.takeaway_enabled) return { ...current, orderType: 'takeaway' }
      return current
    })
  }, [settings])

  const changeQty = (product: Product, quantity: number) => {
    const existingQuantity = cart.find((item) => item.productId === product.id)?.quantity ?? 0
    if ((!product.is_available || !product.is_published) && quantity > existingQuantity) return
    setCart((current) => setQuantity(current, product.id, quantity))
  }

  const beginCheckout = async () => {
    setCheckoutError('')
    setPreparedMessage('')
    setCheckoutOpen(true)
    if (!cart.length) {
      setCheckoutError('Keranjang masih kosong.')
      return
    }
    try {
      const catalog = await getCatalog()
      setProducts(catalog.products)
      const freshCart = validCartItems(cart, catalog.products)
      if (freshCart.length !== cart.length) {
        setCart(freshCart)
        setCheckoutError('Keranjang diperbarui karena beberapa produk sudah tidak tersedia. Periksa ulang sebelum melanjutkan.')
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Harga produk tidak dapat diperiksa.')
    }
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (checkoutLock.current) return
    checkoutLock.current = true
    setPreparing(true)
    setCheckoutError('')
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    try {
      const catalog = await getCatalog()
      const freshItems = validCartItems(cart, catalog.products)
      const currentProducts = new Map(catalog.products.map((product) => [product.id, product]))
      const orderItems = freshItems.flatMap((item) => {
        const product = currentProducts.get(item.productId)
        return product ? [{ product, quantity: item.quantity }] : []
      })
      if (freshItems.length !== cart.length) {
        setCart(freshItems)
        throw new Error('Beberapa produk sudah tidak tersedia. Keranjang diperbarui, mohon periksa kembali.')
      }
      setProducts(catalog.products)
      const currentSettings = await getStoreSettings()
      const validationError = validateCheckout(details, currentSettings, orderItems)
      if (validationError) throw new Error(validationError)
      const message = buildWhatsAppMessage(currentSettings, details, orderItems)
      const url = buildWhatsAppUrl(currentSettings.whatsapp_number, message)
      setPreparedMessage(message)
      if (popup) popup.location.href = url
    } catch (error) {
      popup?.close()
      setCheckoutError(error instanceof Error ? error.message : 'Pesanan tidak dapat disiapkan. Silakan coba kembali.')
    } finally {
      checkoutLock.current = false
      setPreparing(false)
    }
  }

  return (
    <Routes>
      <Route path="/admin/*" element={<Admin />} />
      <Route path="*" element={<>
        <header className="site-header">
          <a className="brand" href="#/"><span className="brand-mark">{storeInitials(settings.store_name)}</span><span><strong>{settings.store_name}</strong><small>{settings.branch_name}</small></span></a>
          <nav className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="Navigasi utama">
            <a href="#menu" onClick={() => setMobileOpen(false)}>Menu</a>
            <a href="#info" onClick={() => setMobileOpen(false)}>Info gerai</a>
          </nav>
          <div className="header-actions">
            <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Keranjang, ${count} item`}>
              <ShoppingBag size={19} /><span className="cart-label">Keranjang</span><span className="count-badge">{count}</span>
            </button>
            <button className="icon-button mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Buka navigasi">{mobileOpen ? <X /> : <MenuIcon />}</button>
          </div>
        </header>
        <main>
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow"><span className="live-dot" /> MENU DIGITAL · {settings.branch_name}</span>
              <h1>Enaknya bikin<br /><em>semangat.</em></h1>
              <p>Pilih menu favoritmu, lalu pesan langsung lewat WhatsApp. Praktis, tanpa antre.</p>
              <a className="primary-button hero-button" href="#menu">Lihat menu <ArrowRight size={18} /></a>
              <div className="hero-note"><span>AYAM LEZAT</span><i /> <span>HARGA BERSAHABAT</span></div>
            </div>
            <div className="hero-art" aria-label="Ilustrasi menu ayam">
              <div className="food-circle"><div className="food-plate"><div className="chicken-piece chicken-one" /><div className="chicken-piece chicken-two" /><div className="chicken-piece chicken-three" /><div className="green-garnish" /></div></div>
              <div className="art-sticker">ENAK<br />POL!</div>
              <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✳</span>
              <div className="art-caption">PENUH RASA. PENUH CERITA.</div>
            </div>
          </section>
          <section className="catalog-section" id="menu">
            <div className="section-heading">
              <div><span className="eyebrow red">PILIHAN FAVORIT</span><h2>Menu kami<span className="title-dot">.</span></h2></div>
              <label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu favorit..." aria-label="Cari produk" /><kbd>⌕</kbd></label>
            </div>
            <div className="category-list" aria-label="Filter kategori">
              <button className={categoryId === 'all' ? 'category-chip active' : 'category-chip'} onClick={() => setCategoryId('all')}>Semua menu</button>
              {categories.map((category) => <button key={category.id} className={categoryId === category.id ? 'category-chip active' : 'category-chip'} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
            </div>
            {loading ? <div className="state-card"><span className="spinner" /><p>Memuat menu terbaru...</p></div> : loadError ? <div className="state-card error-state"><strong>Menu belum dapat dimuat</strong><p>{loadError}</p><button className="secondary-button" onClick={() => void refreshCatalog()}>Coba lagi</button></div> : !filteredProducts.length ? <div className="state-card"><strong>{products.length ? 'Menu tidak ditemukan' : 'Menu sedang disiapkan'}</strong><p>{products.length ? 'Coba kata kunci atau kategori lain.' : 'Silakan kembali beberapa saat lagi.'}</p></div> : <div className="product-grid">
              {filteredProducts.map((product) => <ProductCard key={product.id} product={product} quantity={cart.find((item) => item.productId === product.id)?.quantity ?? 0} onChange={changeQty} />)}
            </div>}
          </section>
          <section className="info-strip" id="info">
            <div className="info-icon"><MapPin size={21} /></div><div><span>LOKASI GERAI</span><strong>{settings.address || settings.branch_name}</strong></div>
            <div className="info-divider" />
            <div className="info-icon"><Clock3 size={21} /></div><div><span>JAM OPERASIONAL</span><strong>{settings.opening_hours || 'Hubungi gerai untuk informasi jam buka'}</strong></div>
          </section>
          {(settings.contact_information || settings.public_information) && <section className="public-extra" aria-label="Informasi gerai"><strong>{settings.contact_information}</strong><p>{settings.public_information}</p></section>}
        </main>
        <footer><a href="#/">{settings.store_name} <span>{settings.branch_name}</span></a><p>Menu digital. Pesanan dikirim langsung ke WhatsApp gerai.</p><Link to="/admin">Admin</Link></footer>

        {cartOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><aside className="side-panel" aria-label="Keranjang belanja">
          <div className="panel-heading"><div><span className="eyebrow red">PESANANMU</span><h2>Keranjang</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang"><X /></button></div>
          {!cart.length ? <div className="empty-cart"><div className="empty-bag"><ShoppingBag /></div><h3>Keranjang masih kosong</h3><p>Tambahkan menu favoritmu untuk mulai memesan.</p><button className="secondary-button" onClick={() => setCartOpen(false)}>Jelajahi menu</button></div> : <>
            <div className="cart-lines">{cart.map((item) => {
              const product = products.find((entry) => entry.id === item.productId)
              if (!product) return <div className="cart-line unavailable" key={item.productId}><div><strong>Produk tidak lagi tersedia</strong><small>Hapus dari keranjang untuk lanjut</small></div><button className="icon-button danger-text" onClick={() => setCart((current) => current.filter((entry) => entry.productId !== item.productId))} aria-label="Hapus produk"><Trash2 size={17} /></button></div>
              return <div className="cart-line" key={item.productId}><div className="cart-product"><strong>{product.name}</strong><small>{formatIDR(product.price)} / item</small><b>{formatIDR(product.price * item.quantity)}</b></div><div className="quantity-control"><button onClick={() => changeQty(product, item.quantity - 1)} aria-label={`Kurangi ${product.name}`}><Minus size={14} /></button><span>{item.quantity}</span><button disabled={!product.is_available} onClick={() => changeQty(product, item.quantity + 1)} aria-label={`Tambah ${product.name}`}><Plus size={14} /></button></div></div>
            })}</div>
            <div className="cart-footer"><button className="text-button danger-text" onClick={() => setCart([])}>Kosongkan keranjang</button><div className="subtotal"><span>Subtotal sementara</span><strong>{formatIDR(cartTotal(cart, products))}</strong></div><p>Biaya antar (jika ada) dihitung pada konfirmasi pesanan.</p><button className="primary-button full-button" disabled={!cart.length} onClick={() => { setCartOpen(false); beginCheckout() }}>Lanjut pesan <ArrowRight size={17} /></button></div>
          </>}
        </aside></div>}

        {checkoutOpen && <div className="modal-backdrop checkout-backdrop"><section className="checkout-modal" aria-labelledby="checkout-title">
          <div className="panel-heading"><div><span className="eyebrow red">LANGKAH TERAKHIR</span><h2 id="checkout-title">Detail pesanan</h2></div><button className="icon-button" onClick={() => setCheckoutOpen(false)} aria-label="Tutup checkout"><X /></button></div>
          {preparedMessage ? <div className="prepared-box"><div className="success-mark">✓</div><h3>Pesan siap dilanjutkan di WhatsApp</h3><p>Pesanan belum terkirim atau terkonfirmasi. Periksa pesan dan tekan <strong>Kirim</strong> di WhatsApp untuk mengirimnya ke gerai.</p><textarea readOnly value={preparedMessage} aria-label="Pesan pesanan WhatsApp" /><div className="form-actions"><button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(preparedMessage); setCopied(true) } catch { setCheckoutError('Pesan tidak dapat disalin otomatis. Pilih dan salin teks pesan secara manual.') } }} type="button">{copied ? 'Tersalin' : 'Salin pesan'}</button><a className="primary-button" href={buildWhatsAppUrl(settings.whatsapp_number, preparedMessage)} target="_blank" rel="noreferrer">Buka WhatsApp <ArrowRight size={17} /></a></div>{checkoutError && <p role="alert" className="form-error">{checkoutError}</p>}</div> : <form onSubmit={submitCheckout} className="checkout-form">
            <div className="checkout-summary"><strong>Ringkasan ({count} item)</strong>{cart.map((item) => { const product = products.find((entry) => entry.id === item.productId); return product ? <div key={item.productId}><span>{product.name} × {item.quantity} @ {formatIDR(product.price)}</span><b>{formatIDR(product.price * item.quantity)}</b></div> : null })}<div><span>Subtotal menu</span><b>{formatIDR(subtotal)}</b></div>{deliveryFee > 0 && <div><span>Biaya antar</span><b>{formatIDR(deliveryFee)}</b></div>}<div className="checkout-total"><span>Total</span><strong>{formatIDR(subtotal + deliveryFee)}</strong></div></div>
            <label>Nama lengkap<input required value={details.customerName} onChange={(e) => setDetails({ ...details, customerName: e.target.value })} placeholder="Nama kamu" /></label>
            <label>Nomor WhatsApp {settings.customer_phone_required ? '(wajib)' : '(opsional)'}<input required={settings.customer_phone_required} inputMode="tel" value={details.customerPhone} onChange={(e) => setDetails({ ...details, customerPhone: e.target.value })} placeholder="08xxxxxxxxxx" /></label>
            <label>Jenis pesanan<select value={details.orderType} onChange={(e) => setDetails({ ...details, orderType: e.target.value as CheckoutDetails['orderType'] })}>{settings.takeaway_enabled && <option value="takeaway">Ambil sendiri (takeaway)</option>}{settings.delivery_enabled && <option value="delivery">Diantar ke alamat</option>}</select></label>
            {details.orderType === 'delivery' && <label>Alamat pengantaran{settings.delivery_address_required && ' (wajib)'}<textarea required={settings.delivery_address_required} rows={2} value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} placeholder="Alamat lengkap dan patokan" />{settings.delivery_fee > 0 && <small>Biaya antar: {formatIDR(settings.delivery_fee)}</small>}</label>}
            <label>Catatan untuk gerai (opsional)<textarea rows={2} value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} placeholder="Contoh: sambal dipisah" /></label>
            <div className="checkout-customer-review"><strong>Detail pelanggan</strong><span>Nama: {details.customerName || 'Belum diisi'}</span><span>WhatsApp: {details.customerPhone || 'Tidak dicantumkan'}</span><span>Jenis: {details.orderType === 'delivery' ? 'Antar' : 'Ambil sendiri'}</span>{details.orderType === 'delivery' && <span>Alamat: {details.address || 'Belum diisi'}</span>}<span>Catatan: {details.notes || 'Tidak ada'}</span></div>
            {checkoutError && <p role="alert" className="form-error">{checkoutError}</p>}
            <button className="primary-button full-button" type="submit" disabled={preparing || !cart.length}>{preparing ? <><span className="spinner small" /> Menyiapkan pesanan...</> : <>Lanjut ke WhatsApp <ArrowRight size={17} /></>}</button>
            <p className="privacy-note">WhatsApp akan dibuka dengan pesan terisi. Anda tetap perlu menekan Kirim sendiri.</p>
          </form>}
        </section></div>}
      </>} />
    </Routes>
  )
}

function ProductCard({ product, quantity, onChange }: { product: Product; quantity: number; onChange: (product: Product, quantity: number) => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = product.image_url || product.image_path
  return <article className="product-card">
    <div className="product-image">{image && !imageFailed ? <img src={image} alt={product.name} loading="lazy" onError={() => setImageFailed(true)} /> : <div className="image-placeholder"><span>RC</span></div>}{product.is_available ? <span className="product-tag">FAVORIT</span> : <span className="product-tag sold-out-tag">HABIS</span>}</div>
    <div className="product-content"><h3>{product.name}</h3><p>{product.description || 'Racikan lezat untuk menemani harimu.'}</p><div className="product-card-bottom"><strong>{formatIDR(product.price)}</strong>{quantity ? <div className="quantity-control card-quantity"><button onClick={() => onChange(product, quantity - 1)} aria-label={`Kurangi ${product.name}`}><Minus size={14} /></button><span>{quantity}</span><button disabled={!product.is_available} onClick={() => onChange(product, quantity + 1)} aria-label={`Tambah ${product.name}`}><Plus size={14} /></button></div> : <button className="add-button" disabled={!product.is_available} onClick={() => onChange(product, 1)} aria-label={product.is_available ? `Tambah ${product.name} ke keranjang` : `${product.name} sedang habis`}>{product.is_available ? <><Plus size={18} /> Tambah</> : 'Sedang habis'}</button>}</div></div>
  </article>
}
