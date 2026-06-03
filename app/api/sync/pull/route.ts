import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import Papa from "papaparse";

const COLUMNS = {
  KODE_ACCURATE: 1, // Kolom B (Index 1 di Array)
  NAMA_BARANG: 2,   // Kolom C
  BARCODE: 4,       // Kolom E
  KATEGORI: 5,      // Kolom F
  BRAND: 6,         // Kolom G
  STATUS: 7,        // Kolom H
  CP: 8,            // Kolom I
  SP: 9,            // Kolom J
  PRICE: 10         // Kolom K
};

export async function POST() {
  const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;
  
  if (!csvUrl) {
    return NextResponse.json({ error: "GOOGLE_SHEET_CSV_URL is not configured" }, { status: 500 });
  }

  try {
    // 1. Fetch CSV from Google Sheets
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }
    const csvText = await response.text();

    // 2. Parse CSV
    const parsed = Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length <= 1) {
      return NextResponse.json({ error: "No data found in CSV" }, { status: 400 });
    }

    // 3. Transform to Supabase records
    const records = [];
    const today = new Date().toISOString().split("T")[0];

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const rowData = rows[i];
      const kode = String(rowData[COLUMNS.KODE_ACCURATE] || "").trim();
      
      if (!kode) continue; // Skip if no Kode Accurate

      records.push({
        "Kode Accurate": kode,
        "NAMA BARANG": String(rowData[COLUMNS.NAMA_BARANG] || "").trim() || null,
        "barcode_ean": String(rowData[COLUMNS.BARCODE] || "").trim() || null,
        "KATEGORI": String(rowData[COLUMNS.KATEGORI] || "").trim() || null,
        "NAMA BRAND": String(rowData[COLUMNS.BRAND] || "").trim() || null,
        "STATUS": String(rowData[COLUMNS.STATUS] || "").trim() || null,
        "CP": String(rowData[COLUMNS.CP] || "").trim() || null,
        "SP": String(rowData[COLUMNS.SP] || "").trim() || null,
        "PRICE": String(rowData[COLUMNS.PRICE] || "").trim() || null,
        "TANGGAL UPDATE": today,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid records to insert" }, { status: 400 });
    }

    // 4. Batch Upsert to Supabase (chunks of 1000)
    const supabase = createServiceClient();
    const chunkSize = 1000;
    let upsertedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("products")
        .upsert(chunk, { onConflict: "Kode Accurate" });

      if (error) {
        console.error("Batch upsert error:", error);
        errors.push(`Chunk ${i / chunkSize + 1} failed: ${error.message}`);
      } else {
        upsertedCount += chunk.length;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: "Some batches failed", 
        details: errors, 
        upserted: upsertedCount 
      }, { status: 207 }); // Multi-Status
    }

    return NextResponse.json({ 
      success: true, 
      upserted: upsertedCount,
      message: `Berhasil menarik ${upsertedCount} baris data dari Sheet.`
    });

  } catch (error: any) {
    console.error("Pull Sync Error:", error);
    return NextResponse.json({ error: error.message || "Failed to pull data" }, { status: 500 });
  }
}
