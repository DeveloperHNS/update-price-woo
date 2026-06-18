// ==========================================
// SCRIPT SINKRONISASI REAL-TIME GOOGLE SHEETS
// ==========================================

// 1. Konfigurasi Webhook
// Ganti dengan URL Vercel aplikasi kamu atau URL ngrok jika sedang testing lokal
const WEBHOOK_URL = "https://update-price-woo.vercel.app/api/sheet/webhook";

// Ganti dengan isi SHEET_WEBHOOK_SECRET dari file .env kamu
const WEBHOOK_SECRET = "hns_super_secret_webhook_token_2026"; 

// 2. Konfigurasi Posisi Kolom
// Sesuaikan angka ini dengan posisi kolom di Spreadsheet kamu (A=1, B=2, C=3, dst)
const COLUMNS = {
  KODE_ACCURATE: 2, // Kolom B
  NAMA_BARANG: 3,   // Kolom C
  BARCODE: 5,       // Kolom E (karena D terlihat kosong/sempit)
  KATEGORI: 6,      // Kolom F
  BRAND: 7,         // Kolom G
  STATUS: 8,        // Kolom H
  CP: 9,            // Kolom I (Asumsi)
  SP: 10,           // Kolom J (Asumsi)
  PRICE: 11         // Kolom K (Asumsi)
};

// 3. Fungsi Utama (Otomatis berjalan setiap kali ada cell yang diedit)
function onEdit(e) {
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  
  // Membatasi hanya bekerja di sheet MASTER_DATA
  if (sheet.getName() !== "MASTER_DATA") return;
  
  const row = e.range.getRow();
  
  // Abaikan jika yang diedit adalah baris pertama (Header)
  if (row <= 1) return;

  // Ambil seluruh data dari baris yang diedit
  const lastCol = sheet.getLastColumn();
  const maxCol = Math.max(lastCol, 9); // Setidaknya ambil sampai kolom ke-9
  const rowData = sheet.getRange(row, 1, 1, maxCol).getValues()[0];
  
  // Bentuk payload data sesuai dengan format yang diminta aplikasi kita
  const payload = {
    kode_accurate: String(rowData[COLUMNS.KODE_ACCURATE - 1] || ""),
    nama_barang: String(rowData[COLUMNS.NAMA_BARANG - 1] || ""),
    barcode: String(rowData[COLUMNS.BARCODE - 1] || ""),
    kategori: String(rowData[COLUMNS.KATEGORI - 1] || ""),
    brand: String(rowData[COLUMNS.BRAND - 1] || ""),
    status: String(rowData[COLUMNS.STATUS - 1] || ""),
    cp: String(rowData[COLUMNS.CP - 1] || ""),
    sp: String(rowData[COLUMNS.SP - 1] || ""),
    price: String(rowData[COLUMNS.PRICE - 1] || "")
  };
  
  // Validasi: Jangan kirim kalau tidak ada kode produknya
  if (!payload.kode_accurate || payload.kode_accurate.trim() === "") return;

  // Setup konfigurasi request untuk mengirim data
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-webhook-secret": WEBHOOK_SECRET
    },
    payload: JSON.stringify([payload]), // Harus dikirim dalam bentuk Array (kurung siku)
    muteHttpExceptions: true
  };

  try {
    // Tembak URL Webhook aplikasi kita!
    UrlFetchApp.fetch(WEBHOOK_URL, options);
  } catch (error) {
    console.error("Gagal mengirim webhook:", error);
  }
}
