# WooCommerce & Accurate Price Sync Application

Aplikasi web berbasis Next.js untuk menyelaraskan harga produk (Suggested Retail Price / SRP) dari Accurate ERP / Google Sheets ke WooCommerce. Aplikasi ini mempermudah proses mapping produk, penyesuaian harga, serta manajemen katalog WooCommerce dalam satu dashboard terintegrasi.

---

## 🚀 Fitur Utama

1. **Sinkronisasi Harga SRP (SP)**: Mengambil data harga dari Accurate (kolom `SP`) dan menyinkronkannya secara manual ke kolom `regular_price` di WooCommerce (baik produk simple maupun variasi).
2. **Tampilan Harga Dealer (PRICE)**: Menampilkan harga dealer di halaman sinkronisasi produk dan modal mapping untuk membantu PIC/Admin dalam peninjauan harga sebelum disinkronkan.
3. **Mapping Produk (Product Matching)**:
   * **Belum Dimapping**: Daftar produk baru dari Accurate yang belum terhubung dengan WooCommerce.
   * **Perlu Review**: Mapping otomatis atau lama yang membutuhkan konfirmasi ulang.
   * **Sudah Dimapping**: Produk yang sudah aktif terhubung dan siap disinkronkan harganya.
   * **Dukungan Produk Variasi**: Memungkinkan pencocokan produk Accurate ke variasi tertentu di WooCommerce.
4. **Upload Produk Baru**: 
   * Integrasi Media WordPress untuk upload gambar produk.
   * Fitur pembuatan produk sederhana (*Simple Product*) dan variasi (*Variable Product*).
   * Generator variasi otomatis berdasarkan kombinasi atribut.
5. **Manage Products Dashboard**:
   * Tabel katalog WooCommerce dengan pencarian dan filter kategori.
   * *Sorting* multi-state (3-state: Ascending, Descending, Default) pada seluruh header kolom (kecuali Kontrol).
   * Edit langsung (*inline editing*) untuk Nama, SKU, dan Harga.
   * Switch cepat untuk mengubah status stok (Ada / Habis) dan status visibilitas (Publish / Private).
6. **Pembagian Hak Akses (Role-based Access)**:
   * **Admin**: Dapat melihat, memetakan, dan mengedit seluruh produk di semua kategori.
   * **PIC**: Terbatas hanya pada kategori yang ditugaskan (Komponen, Laptop, atau Aksesoris).

---

## 🛠️ Konfigurasi Environment (`.env` & `.env.local`)

Buat file `.env` dan `.env.local` di folder root project dengan variabel berikut:

```env
# URL Utama Aplikasi
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Konfigurasi WooCommerce API (REST API)
WOO_URL=https://website-kamu.com
WOO_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WOO_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Konfigurasi WordPress Media API (untuk Upload Gambar)
WP_URL=https://website-kamu.com/
WP_USERNAME=username_wp
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# Konfigurasi Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Webhook Secret untuk Sinkronisasi Sheet
SHEET_WEBHOOK_SECRET=token_secret_kamu

# Konfigurasi Akun Admin Default (untuk scripts/create-admin.mjs)
ADMIN_EMAIL=admin@hnsitcenter.id
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=Administrator
```

---

## 📦 Instalasi & Cara Menjalankan

### 1. Instalasi Dependensi
Jalankan perintah berikut di terminal:
```bash
npm install
```

### 2. Jalankan Migrasi Database di Supabase
Pastikan Anda sudah membuat tabel-tabel berikut di database Supabase Anda:
* `profiles`
* `products`
* `product_woo_mapping`
* `sync_log`
* `activity_logs`

### 3. Membuat Akun Admin Pertama
Jalankan script mjs untuk mendaftarkan user admin default yang telah diatur di `.env`:
```bash
node scripts/create-admin.mjs
```

### 4. Menjalankan Server Development
Jalankan server lokal Next.js:
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### 5. Live Testing dengan Ngrok
Jika Anda ingin mengekspos aplikasi lokal ke internet (untuk integrasi webhook Google Sheet atau testing di HP):
```bash
npx ngrok http 3000
```
Gunakan URL publik forwarding yang dihasilkan (misal `https://xxxx.ngrok-free.app`) untuk konfigurasi webhook.

---

## 🔄 Alur Kerja Penggunaan

### A. Ingestion Produk (Update dari Accurate/Google Sheet)
1. Atur Google Apps Script di Google Sheets Anda untuk mengirimkan payload data produk ke URL Webhook: `https://<DOMAIN-ANDA>/api/sheet/webhook`.
2. Jangan lupa menambahkan header `x-webhook-secret` sesuai nilai `SHEET_WEBHOOK_SECRET` Anda.
3. Setiap kali ada perubahan harga atau produk baru di sheet, data akan otomatis masuk ke tabel `products` di database Supabase.

### B. Proses Matching / Mapping Produk
1. Buka halaman **Sync Harga** di menu Dashboard.
2. Pada tab **Belum Dimapping**, pilih produk yang ingin dihubungkan lalu klik tombol **Match**.
3. Cari produk padanannya di WooCommerce berdasarkan Nama atau SKU.
4. Jika produk tersebut bertipe *Variable*, Anda wajib memilih variasi spesifik yang sesuai.
5. Klik **Konfirmasi Match**. Data mapping akan disimpan ke Supabase dan berpindah ke tab **Sudah Dimapping**.

### C. Sinkronisasi Harga ke WooCommerce
1. Di halaman **Sync Harga** -> tab **Sudah Dimapping**.
2. Cari produk yang ingin di-update harganya.
3. Klik tombol **Sync Harga**.
4. Sistem akan mengambil harga `SP` (SRP) dari Supabase, memformatnya, lalu mengirimkannya ke WooCommerce API.
5. Hasil sinkronisasi (sukses/gagal) akan tercatat di log aktivitas.

### D. Manajemen Produk WooCommerce
1. Buka halaman **Manage Products** untuk melihat daftar produk aktif di WooCommerce Anda.
2. Gunakan header tabel untuk mengurutkan produk (misal: urutkan berdasarkan harga atau stok).
3. Anda dapat mengedit Nama, SKU, atau Harga secara langsung di tabel.
4. Gunakan toggle stok untuk mengubah status produk secara cepat (In Stock / Out of Stock).
5. Ubah status visibilitas produk (Publish / Private) untuk mengatur tampilannya di toko online Anda.
