import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Column names in 'products' table (from Accurate/Google Sheet)
export type AccurateProduct = {
  "Kode Accurate": string | null;
  "NAMA BARANG": string | null;
  "STATUS": string | null;
  "CP": string | null;   // Cost Price (modal)
  "SP": string | null;   // Selling Price (SRP → WooCommerce regular_price)
  "PRICE": string | null;
  "TANGGAL UPDATE": string | null;
  "KATEGORI": string | null;
  "NAMA BRAND": string | null;
  "Stok Sistem": number | null;
  "NON AKTIF": string | null;
  "LOKASI": string | null;
  barcode_ean: string | null;
  min_stock: number | null;
  unit: string | null;
};

export type WooMapping = {
  id: number;
  kode_accurate: string;
  woo_product_id: number;
  woo_variation_id: number | null;
  woo_sku_full: string | null;
  woo_name: string | null;
  is_active: boolean;
  needs_review: boolean;
  confidence_score: number | null;
  match_method: string | null;
  created_at: string;
  updated_at: string;
};

// Maps pic_category from profiles to KATEGORI keywords in products table
export const PIC_CATEGORY_KEYWORDS: Record<string, string[]> = {
  komponen: ["komponen", "component"],
  laptop: ["laptop", "printer", "laser"],
  aksesoris: ["aksesoris", "aksesori", "accessories", "accessory"],
};

// Parse price string from Accurate (e.g. "5.000.000" or "5000000") to plain number string
export function parseAccuratePrice(raw: string | null | undefined): string {
  if (!raw) return "";
  // Remove Rp, spaces, dots used as thousand separators, then handle comma decimal
  const cleaned = raw.replace(/[Rp\s]/gi, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "";
  return String(Math.round(num));
}
