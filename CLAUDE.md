@AGENTS.md

## Task List: HNS SYNC V2 (Stock Movement Analysis)

- [ ] **Tahap 1: Persiapan Database & Lingkungan**
  - [x] Buat script SQL untuk pembuatan tabel `stock_snapshots`.
  - [ ] User meng-eksekusi SQL di Supabase.
  - [ ] Update `.env.local` dengan 3 ID Google Sheets (Gudang, Nagoya, Gateway).

- [ ] **Tahap 2: Core Engine (Data Ingestion)**
  - [ ] Buat *endpoint* `/api/v2/snapshot/route.ts`.
  - [ ] Koding logika penarikan data dari 3 Google Sheets.
  - [ ] Koding *Movement Logic* (bandingkan `qty` & masukkan ke `stock_movements`).
  - [ ] Koding *Snapshot Logic* (simpan angka hari ini ke `stock_snapshots`).
  - [ ] Koding update `stock_locations` dan kolom `Stok Sistem` di `products`.
  - [ ] Koding *Alert Check* (masukkan ke `stock_alerts` jika stok < min).
  - [ ] Koding *Archiving/Cleanup* (simpan data > 30 hari ke GDrive, lalu hapus dari DB).

- [ ] **Tahap 3: WooCommerce Stock Guard**
  - [ ] Modifikasi API sync WooCommerce (`/api/sync/price/route.ts`).
  - [ ] Hapus parameter pengiriman `stock_quantity`.
  - [ ] Kirim hanya `instock` atau `outofstock` berdasarkan Total Stok Gabungan.

- [ ] **Tahap 4: UI Dashboard Analitik**
  - [ ] Buat UI Halaman `/dashboard/analytics/page.tsx` sesuai *mockup* Figma.
  - [ ] Buat 3 tabel: Fast-Moving, Slow-Moving, dan Daftar Belanja.
  - [ ] Tambahkan tombol *trigger* "Ambil Data Stok Hari Ini".
  - [ ] Daftarkan menu "Analisa Stok" di komponen `Sidebar.tsx`.
