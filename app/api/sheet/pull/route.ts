import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import Papa from "papaparse";

export async function POST(req: NextRequest) {
  try {
    const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;
    
    if (!csvUrl) {
      return NextResponse.json({ error: "GOOGLE_SHEET_CSV_URL belum diatur di .env.local" }, { status: 500 });
    }

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil CSV dari Google Sheet: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV
    const { data, errors } = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (errors && errors.length > 0) {
      console.warn("CSV parsing warnings:", errors);
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Data kosong dari Google Sheet" }, { status: 400 });
    }
    
    const supabase = createServiceClient();
    
    // 1. Ambil data mapping saat ini untuk mencegah overwrite produk yang sudah ter-mapping
    const { data: existingMappings } = await supabase.from("product_woo_mapping").select("kode_accurate, woo_product_id, is_active, match_method");
    const mappingMap = new Map<string, any>();
    if (existingMappings) {
      for (const m of existingMappings) {
        mappingMap.set(m.kode_accurate, m);
      }
    }
    
    let upserted = 0;
    const errList: string[] = [];
    
    const BATCH_SIZE = 50;
    let upsertQueue: Record<string, unknown>[] = [];
    let inactiveKodes: string[] = [];
    let restoreKodes: string[] = [];
    
    
    const flushQueue = async () => {
      if (upsertQueue.length > 0) {
        const { error } = await supabase.from("products").upsert(upsertQueue, { onConflict: "Kode Accurate" });
        if (error) {
          errList.push(`Batch error: ${error.message}`);
        } else {
          upserted += upsertQueue.length;
        }
        upsertQueue = [];
      }

      if (inactiveKodes.length > 0) {
        // 1. Delete mapping lama
        await supabase.from("product_woo_mapping").delete().in("kode_accurate", inactiveKodes);
        
        // 2. Insert sebagai ignored
        const ignoredMappings = inactiveKodes.map(kode => ({
          kode_accurate: kode,
          woo_product_id: 0,
          woo_variation_id: null,
          woo_name: "IGNORED",
          woo_sku_full: "",
          needs_review: false,
          is_active: false,
          confidence_score: 100,
          match_method: "auto_ignore"
        }));
        
        const { error: ignoreErr } = await supabase.from("product_woo_mapping").insert(ignoredMappings);
        if (ignoreErr) {
          errList.push(`Auto-ignore error: ${ignoreErr.message}`);
        }
        inactiveKodes = [];
      }

      if (restoreKodes.length > 0) {
        // Hapus mapping IGNORED agar kembali ke tab Unmatched
        await supabase.from("product_woo_mapping").delete().in("kode_accurate", restoreKodes);
        restoreKodes = [];
      }
    };
    
    for (const row of data as any[]) {
      // Find keys ignoring case/spaces
      const getVal = (possibleKeys: string[]) => {
        const key = Object.keys(row).find(k => possibleKeys.includes(k.trim().toUpperCase()));
        return key ? row[key] : null;
      };
      
      const kodeAccurate = getVal(["KODE ACCURATE", "KODE", "KODE_ACCURATE"]);
      if (!kodeAccurate) continue;
      
      const namaBarang = getVal(["NAMA BARANG", "NAMA", "NAMA_BARANG"]);
      const barcode = getVal(["UPC/BARCODE", "BARCODE", "UPC", "BARCODE_EAN"]);
      const kategori = getVal(["NAMA KATEGORI", "KATEGORI"]);
      const brand = getVal(["NAMA BRAND", "BRAND"]);
      const status = getVal(["STATUS", "STATUS BARANG"]);
      const cp = getVal(["CP", "MODAL"]);
      const sp = getVal(["SP", "HARGA JUAL", "SRP"]);
      const price = getVal(["PRICE", "HARGA DEALER", "DEALER"]);
      const stok = getVal(["STOK", "STOCK", "QTY"]);
      
      const record: Record<string, unknown> = {
        "Kode Accurate": kodeAccurate,
        "TANGGAL UPDATE": new Date().toISOString().split("T")[0]
      };
      
      if (namaBarang) record["NAMA BARANG"] = namaBarang;
      if (barcode) record["barcode_ean"] = barcode;
      if (kategori) record["KATEGORI"] = kategori;
      if (brand) record["NAMA BRAND"] = brand;
      if (status) record["STATUS"] = status;
      if (cp) record["CP"] = cp;
      if (sp) record["SP"] = sp;
      if (price) record["PRICE"] = price;
      if (stok !== null && stok !== undefined && stok !== "") {
        const parsedStok = parseInt(stok.toString().replace(/,/g, ""), 10);
        if (!isNaN(parsedStok)) record["Stok Sistem"] = parsedStok;
      }
      
      upsertQueue.push(record);

      const statusValue = status ? status.toString().trim().toUpperCase() : "";
      const existingMapping = mappingMap.get(kodeAccurate);
      const isAlreadyMappedToWoo = existingMapping && existingMapping.woo_product_id !== 0;
      const isCurrentlyIgnored = existingMapping && existingMapping.is_active === false;

      if (statusValue === "YA") {
        if (!isAlreadyMappedToWoo) {
          inactiveKodes.push(kodeAccurate);
        }
      } else if (statusValue === "TIDAK" || statusValue === "") {
        if (isCurrentlyIgnored && !isAlreadyMappedToWoo) {
          restoreKodes.push(kodeAccurate);
        }
      }
      
      if (upsertQueue.length >= BATCH_SIZE) {
        await flushQueue();
      }
    }
    
    await flushQueue();
    
    return NextResponse.json({
      success: true,
      upserted,
      total: data.length,
      errors: errList.length > 0 ? errList : undefined,
    });
    
  } catch (err: any) {
    console.error("Sheet Pull Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
