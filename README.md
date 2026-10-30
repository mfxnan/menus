# Rocket Chicken KS Tubun — Menu Digital

Website menu dan daftar harga responsif untuk gerai Rocket Chicken KS Tubun, Purwokerto. Pelanggan memilih menu dan menyusun pesan yang diteruskan ke WhatsApp gerai; pengiriman pesan tetap harus dilakukan secara manual oleh pelanggan.

## Fitur dan batasan

- Katalog, kategori, harga, ketersediaan, foto, dan informasi gerai dibaca dari Supabase; Realtime memperbarui katalog secara langsung, dengan refresh berkala sebagai fallback.
- Pencarian, filter kategori, keranjang lokal, validasi data terkini sebelum checkout, dan ringkasan harga Rupiah.
- Checkout membentuk pesan berbahasa Indonesia ke **nomor WhatsApp gerai**, bukan nomor pelanggan.
- Panel admin dengan Supabase Auth untuk mengelola produk, kategori, foto Storage, dan pengaturan toko.
- Tidak ada POS/kasir, pembayaran, penyimpanan transaksi/pesanan, struk, riwayat penjualan, atau laporan penjualan.
- Membuka WhatsApp **tidak** berarti pesanan telah terkirim, diterima, dikonfirmasi, atau dibayar. Pelanggan harus memeriksa pesan lalu menekan **Kirim** di WhatsApp. Aplikasi tidak menyimpan transaksi.

## Teknologi

React 18, TypeScript strict, Vite 6, Tailwind CSS 3, React Router 6 (`HashRouter`), Supabase Auth/PostgreSQL/Storage, Lucide React, Vitest, React Testing Library, dan GitHub Actions.

## Persiapan dan menjalankan lokal

Persyaratan: Node.js 22 LTS atau lebih baru dan npm.

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

Isi `.env.local` sebelum menggunakan katalog Supabase. Jika belum tersedia, aplikasi tetap dirender dan menampilkan pesan konfigurasi yang harus dilengkapi.

Perintah pemeriksaan:

```sh
npm run typecheck
npm test
npm run build
```

## Supabase dan konfigurasi environment

1. Buat atau pilih proyek Supabase. Cadangkan database sebelum menjalankan perubahan skema.
2. Di **Project Settings → API**, ambil Project URL dan **publishable key** (atau anon/public key lama).
3. Salin `.env.example` ke `.env.local`, lalu isi:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
   ```

   Aplikasi juga menerima `VITE_SUPABASE_ANON_KEY` untuk proyek yang masih memakai anon key lama.
4. Nilai `VITE_` dimasukkan ke JavaScript yang dikirim ke browser. URL dan publishable/anon key memang bersifat publik dan aman hanya jika kebijakan RLS di bawah aktif. **Jangan pernah** memasukkan service-role key ke `.env`, source frontend, bundle, atau Git.
5. Jalankan SQL migration secara berurutan di Supabase SQL Editor atau melalui Supabase CLI:
   - [`202610230001_core_schema.sql`](./supabase/migrations/202610230001_core_schema.sql): tabel baru, indeks, validasi, RLS, dan bucket Storage.
   - Impor data menu lama sesuai bagian berikut, lalu jalankan [`202610230002_import_legacy_menus.sql`](./supabase/migrations/202610230002_import_legacy_menus.sql).

### Impor lampiran SQL yang sudah ada

[`supabase/seed/legacy_menus_rows.sql`](./supabase/seed/legacy_menus_rows.sql) adalah satu perintah `INSERT INTO public.menus` dengan 106 baris, bukan definisi tabel. Tabel `public.menus` harus sudah ada dengan kolom yang disebut pada `INSERT`.

- Bila tabel lama sudah ada, jalankan migration inti terlebih dahulu, pastikan tabel itu berisi data lampiran, lalu jalankan migration impor kedua.
- Bila tabel itu belum ada, jalankan [`legacy_menus_table.sql`](./supabase/legacy_menus_table.sql) terlebih dahulu, jalankan lampiran SQL di SQL Editor, lalu jalankan kedua migration secara berurutan.
- Bila migration impor sudah pernah dijalankan sebelum lampiran dimasukkan, jalankan ulang isi migration impor setelah data tersedia. Impor menggunakan `ON CONFLICT DO NOTHING`, sehingga aman dijalankan ulang dan tidak menghapus tabel sumber.
- **Penting:** [`202610230002_import_legacy_menus.sql`](./supabase/migrations/202610230002_import_legacy_menus.sql) bergantung pada isi tabel `public.menus`. Jangan jalankan migration ini melalui `supabase db push` sebelum data legacy tersedia di tabel tersebut. Gunakan [`supabase/seed/import_legacy_menus.sql`](./supabase/seed/import_legacy_menus.sql) untuk impor yang lebih aman dengan pesan diagnostik dan urutan kategori dari data sumber.
- Kategori dibuat dari nilai `display_category` (atau `category` sebagai fallback) pada data yang diberikan. Nama tersebut bukan daftar kategori yang ditebak atau dikunci di kode; admin dapat mengganti nama, urutan, dan visibilitas, serta menambah kategori. Jumlah kategori di database fleksibel sehingga 13 kategori dapat dikelola tanpa perubahan source code.
- Produk `active = false` diimpor tidak tersedia dan tidak dipublikasikan. Harga sumber harus berupa bilangan Rupiah bulat. URL gambar eksternal yang sudah ada dipertahankan; gambar baru dikelola melalui Storage.

Periksa jumlah dan kategori hasil impor di Supabase sebelum melanjutkan. Jangan jalankan insert lampiran berulang tanpa memahami primary key dan isi tabel sumber.

### RLS, storage, dan administrator pertama

Migration mengaktifkan RLS pada tabel profil, kategori, produk, dan pengaturan gerai. Pengunjung hanya dapat membaca kategori aktif, produk terpublikasi (termasuk produk habis), dan informasi publik gerai. Perubahan tabel memerlukan `profiles.role = 'admin'`, yang diperiksa oleh fungsi `is_admin()` `SECURITY DEFINER` dengan `search_path` tetap. Kebijakan gambar mengizinkan pembacaan publik, tetapi unggah, penggantian, dan penghapusan hanya untuk administrator.

Untuk membuat administrator pertama dengan aman:

1. Di Supabase **Authentication → Users**, tambahkan pengguna administrator secara manual. Jangan mengaktifkan pendaftaran admin publik.
2. Salin UUID pengguna tersebut. Di SQL Editor jalankan dengan UUID aktual:

   ```sql
   insert into public.profiles (id, role)
   values ('UUID-USER-AUTH-ANDA', 'admin')
   on conflict (id) do update set role = excluded.role;
   ```

3. Login pada `/#/admin`. Password tetap dikelola oleh Supabase Auth; tidak ada password khusus aplikasi di database.

Bucket `product-images` dibuat sebagai bucket publik dengan batas ukuran 5 MB dan tipe JPEG, PNG, atau WebP. URL publik gambar memang dapat dilihat pengunjung; hanya admin yang berhak mengubah objeknya. Untuk mengubah batas ini, revisi migration dan kebijakan Storage secara sadar.

## Menggunakan dashboard

- **Produk:** tambah/edit nama, deskripsi, harga integer Rupiah, kategori, gambar/pratinjau, urutan, status tersedia/habis, dan publikasi. Arsip memerlukan konfirmasi dan menyembunyikan produk dari katalog. Produk habis yang tetap terpublikasi terlihat dengan label habis dan tidak dapat ditambahkan.
- **Kategori:** tambah/edit kategori dan deskripsi, tampilkan/sembunyikan, cari, dan ubah urutan. Kategori yang masih dipakai produk aktif tidak dapat diarsipkan; pindahkan atau arsipkan produknya lebih dahulu.
- **Pengaturan:** nama gerai, nomor WhatsApp tujuan, kontak publik, alamat, jam buka, jenis layanan, kewajiban alamat/nomor pelanggan, biaya antar, dan informasi publik.
- Perubahan disimpan langsung ke Supabase. Error jaringan/RLS ditampilkan agar admin dapat mencoba lagi.

Nomor tujuan WhatsApp disimpan sebagai digit internasional: `62` diikuti nomor Indonesia tanpa `+`, spasi, atau tanda hubung, misalnya `6281234567890`. Form admin menerima nomor lokal umum dan menormalisasinya saat penyimpanan.

## Checkout WhatsApp

Sebelum membentuk pesan, aplikasi membaca kembali katalog dan pengaturan terkini, membersihkan item yang tidak tersedia, dan menggunakan harga server terbaru. Pesan berisi gerai, nama dan nomor pelanggan (jika diisi), jenis pesanan, alamat antar, item, jumlah, harga satuan, subtotal, biaya antar, total, dan catatan. URL dibentuk memakai format `https://wa.me/nomor?text=...` dengan encoding URL.

Browser dapat membuka aplikasi WhatsApp atau WhatsApp Web. Jika popup diblokir atau WhatsApp tidak tersedia, halaman checkout tetap menampilkan teks pesan, tombol salin, dan tautan untuk mencoba membuka WhatsApp. Pesanan hanya terkirim setelah pelanggan sendiri menekan **Kirim**; website tidak memberi tanda pesanan diterima atau mencatat penjualan.

## GitHub Pages

1. Push branch `main` ke GitHub dan di **Settings → Pages** pilih **GitHub Actions** sebagai source.
2. Tambahkan repository **Variables** (bukan service-role secret):
   - `SUPABASE_URL`: URL proyek Supabase.
   - `SUPABASE_PUBLISHABLE_KEY`: publishable key (atau `SUPABASE_ANON_KEY` untuk key lama).
   - `PAGES_BASE_PATH` (opsional): path Vite, misalnya `/nama-repository/`. Untuk custom domain yang dilayani dari root, isi `/`.
3. Workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) memasang dependency, menjalankan TypeScript, tes, build, lalu menerbitkan `dist`. Untuk repository Pages biasa base path ditentukan dari nama repository pada workflow; `PAGES_BASE_PATH` dapat menggantikannya.
4. Pantau tab **Actions** untuk memastikan deploy berhasil. Belum ada klaim bahwa website ini sudah diterbitkan.

HashRouter memungkinkan halaman admin dan menu bekerja pada subpath Pages tanpa konfigurasi fallback SPA. Tidak diperlukan rahasia server-side untuk build publik. Jika variabel Supabase belum tersedia, build tetap menampilkan petunjuk setup, tetapi fitur data/auth belum dapat dipakai.

## Skema singkat

- `profiles`: peran administrator terhubung ke `auth.users`.
- `categories`: kategori yang dapat diurutkan, dinonaktifkan, dan diarsipkan.
- `products`: katalog harga integer, referensi kategori, status publik/ketersediaan, serta path/URL foto.
- `store_settings`: satu baris konfigurasi publik gerai dan checkout.
- Storage bucket `product-images`: foto menu.

Tidak ada tabel pesanan, transaksi, pembayaran, atau penjualan.

## Troubleshooting dan keamanan

- **Menu belum dapat dimuat:** cek URL/key, koneksi internet, status proyek, migration, dan RLS.
- **Admin tidak dapat login/ditolak:** pastikan pengguna Auth ada dan UUID-nya memiliki profil `admin`; periksa pesan error dan policy.
- **Foto gagal diunggah:** periksa MIME, ukuran maksimum 5 MB, sesi login, bucket, dan policy Storage.
- **Nomor WhatsApp tidak valid:** gunakan kode negara `62` dan 8–13 digit sesudahnya.
- **Kategori/produk tidak tampil:** pastikan kategori aktif, produk dipublikasikan, dan produk tidak diarsipkan.
- Jangan menaruh service-role key di frontend. RLS adalah lapisan otorisasi, bukan sekadar kontrol tampilan.
- Uji akses publik dengan publishable/anon key hanya untuk query baca yang memang diperlukan katalog; jangan menggunakan service-role key di frontend.

## Checklist dashboard Supabase

Kerjakan langkah-langkah ini secara manual di dashboard Supabase setelah setup awal. Kode tidak dapat menggantikannya.

- [ ] **Matikan pendaftaran publik:** di **Authentication → Providers → Email**, nonaktifkan "Enable Email Signup" agar tidak ada yang bisa mendaftar sendiri sebagai admin.
- [ ] **Atur Site URL dan Redirect URLs:** di **Authentication → URL Configuration**, set Site URL ke URL GitHub Pages (misalnya `https://mfxnan.github.io/menus/`) dan tambahkan URL yang sama ke Redirect URLs.
- [ ] **Periksa backup:** di **Database → Backups**, pastikan backup otomatis aktif sebelum menjalankan migration atau perubahan skema.
- [ ] **Jalankan security check:** jalankan [`supabase/checks/verify_security.sql`](./supabase/checks/verify_security.sql) di SQL Editor dan periksa hasilnya — pastikan semua tabel publik memiliki RLS aktif, terutama `public.menus` (tabel legacy).
- [ ] **Periksa Security Advisor:** di **Database → Security Advisor**, tinjau semua peringatan yang muncul dan tindak lanjuti yang relevan.
- [ ] **Pastikan RLS aktif di `public.menus`:** tabel ini dibuat oleh [`supabase/legacy_menus_table.sql`](./supabase/legacy_menus_table.sql) dengan RLS aktif; verifikasi tidak ada policy yang memperbolehkan akses tak terbatas.
- [ ] **Hapus tabel legacy hanya setelah impor terverifikasi:** jangan hapus `public.menus` sebelum: (1) impor produk terverifikasi lengkap di tabel `products`, (2) backup database dibuat, dan (3) aplikasi sudah berjalan normal dari data baru.
