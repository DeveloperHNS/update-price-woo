import { BookOpen, DollarSign, ArrowLeftRight, UploadCloud, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Topbar */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-10">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-600" />
          Panduan Penggunaan
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Pelajari cara menggunakan Price Manager untuk mengelola harga dan produk WooCommerce.
        </p>
      </div>

      <div className="p-6 max-w-4xl space-y-6">
        
        {/* Manage Products */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">1. Manage Products (Dashboard)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-12">
            <p>Halaman utama ini menampilkan ringkasan data produk dari Accurate dan status mapping-nya ke WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Belum Dimapping:</strong> Produk yang ada di Accurate tapi belum terhubung dengan produk di WooCommerce. Anda harus melakukan sinkronisasi di halaman <b>Sync Harga</b>.</li>
              <li><strong>Perlu Review:</strong> Produk yang sudah otomatis di-mapping oleh sistem namun tingkat keyakinannya (confidence) rendah. Perlu dicek manual apakah benar.</li>
              <li><strong>Sudah Dimapping:</strong> Produk yang sudah terhubung dengan baik dan siap untuk di-update harganya.</li>
            </ul>
          </div>
        </section>

        {/* Sync Harga */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">2. Sync Harga (Mapping Produk)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-12">
            <p>Digunakan untuk menghubungkan (mapping) produk dari Accurate dengan produk yang ada di toko WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pilih tab <strong>Belum Dimapping</strong>.</li>
              <li>Klik tombol <strong>Cari di Woo</strong> pada produk yang ingin di-mapping.</li>
              <li>Sistem akan mencari produk WooCommerce yang namanya mirip.</li>
              <li>Jika sudah sesuai, klik <strong>Pilih & Mapping</strong>.</li>
              <li>Jika produk di WooCommerce memiliki variasi, Anda akan diminta memilih variasi yang tepat.</li>
            </ul>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mt-3 text-amber-800">
              <p className="font-semibold text-xs uppercase mb-1">Penting</p>
              <p>Produk tidak akan muncul di halaman Update Harga jika belum berhasil di-mapping di halaman ini.</p>
            </div>
          </div>
        </section>

        {/* Update Harga */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">3. Update Harga</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-12">
            <p>Halaman khusus untuk mengubah harga produk (Harga Modal / CP dan Harga Dealer) sebelum di-push ke WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pencarian produk sangat cepat. Anda bisa mencari berdasarkan Kode Accurate atau Nama Produk.</li>
              <li>Ubah harga pada kolom <strong>Harga Modal (CP)</strong> atau <strong>Harga Dealer (PRICE)</strong>.</li>
              <li>Baris yang harganya diubah akan berwarna biru muda.</li>
              <li>Setelah selesai mengubah beberapa harga, klik tombol <strong>Simpan Perubahan</strong> di kanan atas.</li>
              <li>Sistem akan menyimpan perubahan ini ke database sistem (belum ke WooCommerce).</li>
            </ul>
          </div>
        </section>

        {/* Push ke Woo */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">4. Upload Product (Push Harga)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-12">
            <p>Langkah terakhir: Mendorong (push) harga yang sudah diatur ke toko WooCommerce secara live.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Klik tombol <strong>Sinkronisasi ke WooCommerce Sekarang</strong>.</li>
              <li>Sistem akan membaca semua mapping produk dan harga SP/CP/PRICE terbaru.</li>
              <li>Tunggu proses sinkronisasi selesai. Semakin banyak produk, semakin lama waktu yang dibutuhkan.</li>
              <li>Jika ada error, Anda bisa melihat detailnya di tabel hasil sinkronisasi.</li>
            </ul>
          </div>
        </section>

        {/* Admin Features */}
        <section className="bg-slate-100 p-6 rounded-2xl border border-slate-300 shadow-inner">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-300 text-slate-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Fitur Khusus Admin</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 pl-12">
            <p>Jika Anda login sebagai <strong>Admin</strong>, Anda akan mendapatkan beberapa akses tambahan:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Manajemen User:</strong> Menambahkan akun baru (PIC), mereset password, dan menghapus pengguna.</li>
              <li><strong>Activity Logs:</strong> Melihat catatan (log) aktivitas semua PIC (siapa yang mengubah harga, melakukan mapping, dll).</li>
              <li><strong>Akses Semua Kategori:</strong> Berbeda dengan PIC yang dibatasi kategorinya (misal: hanya melihat komponen atau laptop), Admin bisa melihat dan mengubah seluruh kategori produk.</li>
            </ul>
          </div>
        </section>
        
        <div className="h-10"></div>
      </div>
    </div>
  );
}
