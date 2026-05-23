import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Shared secret configured in Google Apps Script and in .env.local as SHEET_WEBHOOK_SECRET
const WEBHOOK_SECRET = process.env.SHEET_WEBHOOK_SECRET;

type SheetRow = {
  kode_accurate: string;
  nama_barang: string;
  barcode?: string;
  kategori?: string;
  brand?: string;
  status?: string;
  cp?: string;
  sp?: string;
  price?: string;
};

export async function POST(req: NextRequest) {
  // Verify secret
  const authHeader = req.headers.get("x-webhook-secret");
  if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept single row or array
  const rows: SheetRow[] = Array.isArray(body) ? body : [body as SheetRow];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Empty payload" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let upserted = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.kode_accurate) {
      errors.push("Row missing kode_accurate — skipped");
      continue;
    }

    // Map to products table column names (which have mixed case / spaces)
    const record: Record<string, unknown> = {
      "Kode Accurate": row.kode_accurate,
      "NAMA BARANG": row.nama_barang ?? null,
      barcode_ean: row.barcode ?? null,
      "KATEGORI": row.kategori ?? null,
      "NAMA BRAND": row.brand ?? null,
      "STATUS": row.status ?? null,
      "CP": row.cp ?? null,
      "SP": row.sp ?? null,
      "PRICE": row.price ?? null,
      "TANGGAL UPDATE": new Date().toISOString().split("T")[0],
    };

    const { error } = await supabase
      .from("products")
      .upsert(record, { onConflict: "Kode Accurate" });

    if (error) {
      errors.push(`${row.kode_accurate}: ${error.message}`);
    } else {
      upserted++;
    }
  }

  return NextResponse.json({
    upserted,
    errors: errors.length > 0 ? errors : undefined,
    total: rows.length,
  });
}
