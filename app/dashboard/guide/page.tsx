import { BookOpen, DollarSign, ArrowLeftRight, UploadCloud, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">

      {/* Topbar */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-10">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 shrink-0" />
          Panduan Penggunaan
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Pelajari cara menggunakan Price Manager untuk mengelola harga dan produk WooCommerce.
        </p>
      </div>

      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4 sm:space-y-6 pb-10">

        {/* 1. Manage Products */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">1. Manage Products (Dashboard)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 sm:pl-12">
            <p>Halaman utama ini menampilkan ringkasan data produk dari Accurate dan status mapping-nya ke WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Belum Dimapping:</strong> Produk yang ada di Accurate tapi belum terhubung dengan produk di WooCommerce. Anda harus melakukan sinkronisasi di halaman <b>Sync Harga</b>.</li>
              <li><strong>Perlu Review:</strong> Produk yang sudah otomatis di-mapping oleh sistem namun tingkat keyakinannya (confidence) rendah. Perlu dicek manual apakah benar.</li>
              <li><strong>Sudah Dimapping:</strong> Produk yang sudah terhubung dengan baik dan siap untuk di-update harganya.</li>
            </ul>
          </div>
        </section>

        {/* 2. Sync Harga */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">2. Sync Harga (Mapping Produk)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 sm:pl-12">
            <p>Digunakan untuk menghubungkan (mapping) produk dari Accurate dengan produk yang ada di toko WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Pilih tab <strong>Belum Dimapping</strong>.</li>
              <li>Klik tombol <strong>Cari di Woo</strong> pada produk yang ingin di-mapping.</li>
              <li>Sistem akan mencari produk WooCommerce yang namanya mirip.</li>
              <li>Jika sudah sesuai, klik <strong>Pilih & Mapping</strong>.</li>
              <li>Jika produk di WooCommerce memiliki variasi, Anda akan diminta memilih variasi yang tepat.</li>
            </ul>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mt-3 text-amber-800">
              <p className="font-semibold text-xs uppercase tracking-wide mb-1">Penting</p>
              <p className="text-xs">Produk tidak akan muncul di halaman Update Harga jika belum berhasil di-mapping di halaman ini.</p>
            </div>
          </div>
        </section>

        {/* 3. Update Harga */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">3. Update Harga</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 sm:pl-12">
            <p>Halaman khusus untuk mengubah harga produk (Harga Modal / CP dan Harga Dealer) sebelum di-push ke WooCommerce.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Cari produk berdasarkan Kode Accurate atau Nama Produk.</li>
              <li>Ubah harga pada kolom <strong>Harga Modal (CP)</strong> atau <strong>Harga Dealer (PRICE)</strong>.</li>
              <li>Baris yang harganya diubah akan berwarna biru muda.</li>
              <li>Setelah selesai mengubah, klik tombol <strong>Simpan Perubahan</strong> di kanan atas.</li>
              <li>Sistem akan menyimpan perubahan ini ke database sistem (belum ke WooCommerce).</li>
            </ul>
          </div>
        </section>

        {/* 4. Upload Product */}
        <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">4. Upload Product (Push Harga)</h3>
          </div>
          <div className="text-slate-600 text-sm space-y-3 sm:pl-12">
            <p>Langkah terakhir: Mendorong (push) harga yang sudah diatur ke toko WooCommerce secara live.</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Klik tombol <strong>Sinkronisasi ke WooCommerce Sekarang</strong>.</li>
              <li>Sistem akan membaca semua mapping produk dan harga SP/CP/PRICE terbaru.</li>
              <li>Tunggu proses sinkronisasi selesai. Semakin banyak produk, semakin lama waktunya.</li>
              <li>Jika ada error, lihat detailnya di tabel hasil sinkronisasi.</li>
            </ul>
          </div>
        </section>

        {/* Admin */}
        <section className="bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">Fitur Khusus Admin</h3>
          </div>
          <div className="text-slate-300 text-sm space-y-3 sm:pl-12">
            <p>Jika Anda login sebagai <strong className="text-white">Admin</strong>, Anda mendapatkan akses tambahan:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">Manajemen User:</strong> Menambahkan akun baru (PIC), mereset password, dan menghapus pengguna.</li>
              <li><strong className="text-white">Activity Logs:</strong> Melihat catatan aktivitas semua PIC — siapa yang mengubah harga, melakukan mapping, dll.</li>
              <li><strong className="text-white">Akses Semua Kategori:</strong> Admin bisa melihat dan mengubah seluruh kategori produk (PIC dibatasi kategori tertentu).</li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
