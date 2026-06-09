import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wooProducts, triggered_by } = body;

    if (!wooProducts || !Array.isArray(wooProducts)) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch unmatched Accurate products
    const { data: accProducts, error: errFetch } = await supabase
      .from("products")
      .select("*");

    if (errFetch || !accProducts) throw new Error("Failed to fetch accurate products: " + errFetch?.message);

    // Fetch existing mappings
    const { data: mappings } = await supabase.from("product_woo_mapping").select("kode_accurate");
    const mappedKodes = new Set((mappings || []).map((m: any) => m.kode_accurate));
    
    // Create map of unmatched products
    const unmatchedAccByKode = new Map<string, any>();
    const unmatchedAccByName = new Map<string, any>();
    
    for (const p of accProducts as any[]) {
      const kodeAcc = p["Kode Accurate"];
      if (kodeAcc && !mappedKodes.has(kodeAcc)) {
        unmatchedAccByKode.set(kodeAcc, p);
        if (p["NAMA BARANG"]) {
           unmatchedAccByName.set(p["NAMA BARANG"].trim().toLowerCase(), p);
        }
      }
    }

    const results = [];
    const BATCH_SIZE = 50;
    let upsertQueue: any[] = [];

    const flushQueue = async () => {
      if (upsertQueue.length > 0) {
        const { error } = await supabase.from("product_woo_mapping").upsert(upsertQueue, { onConflict: "kode_accurate" });
        if (error) console.error("Error upserting batch", error);
        upsertQueue = [];
      }
    };

    for (const woo of wooProducts) {
      // Frontend parses the CSV and sends keys as: id, type, sku, name, parent
      const wooIdStr = woo.id;
      const wooTipe = woo.type;
      const wooSku = woo.sku;
      const wooNama = woo.name;
      const wooInduk = woo.parent;

      if (!wooIdStr || !wooNama) continue;

      let matchedAcc = null;
      let matchMethod = "";

      // 1. Try to match by SKU
      if (wooSku) {
        // Extract possible codes (e.g. "2504000504 - 100093" -> ["2504000504", "100093"])
        const possibleCodes = wooSku.split(/[^a-zA-Z0-9]+/).filter((c: string) => c.length > 0);
        
        const matchedKodes = possibleCodes.filter((c: string) => unmatchedAccByKode.has(c));
        
        if (matchedKodes.length > 0) {
          let selectedKode = matchedKodes[0];
          
          if (matchedKodes.length > 1) {
            // Apply priority rule: Priority 2 over 1
            const codeStartingWith2 = matchedKodes.find((c: string) => c.startsWith("2"));
            if (codeStartingWith2) {
              selectedKode = codeStartingWith2;
            }
          }

          matchedAcc = unmatchedAccByKode.get(selectedKode);
          matchMethod = "csv_exact_sku";
        }
      }

      // 2. Fallback to exact Name match if no SKU match
      if (!matchedAcc && wooNama) {
        const lowerName = wooNama.trim().toLowerCase();
        if (unmatchedAccByName.has(lowerName)) {
           matchedAcc = unmatchedAccByName.get(lowerName);
           matchMethod = "csv_exact_name";
        }
      }

      if (matchedAcc) {
        // Parse Woo IDs
        let wooProductId = parseInt(wooIdStr);
        let wooVariationId = null;

        if (wooTipe === "variation") {
          wooVariationId = wooProductId;
          if (wooInduk && wooInduk.includes("id:")) {
            wooProductId = parseInt(wooInduk.replace("id:", "").trim());
          }
        }

        upsertQueue.push({
          kode_accurate: matchedAcc["Kode Accurate"],
          woo_product_id: wooProductId,
          woo_variation_id: wooVariationId,
          woo_name: wooNama,
          woo_sku_full: wooSku || "",
          needs_review: false,
          is_active: true,
          triggered_by: triggered_by || null,
          confidence_score: 100,
          match_method: matchMethod
        });

        results.push({
          kode: matchedAcc["Kode Accurate"],
          status: "matched",
          woo_name: wooNama
        });

        // Remove from unmatched map so we don't map twice
        unmatchedAccByKode.delete(matchedAcc["Kode Accurate"]);
        if (matchedAcc["NAMA BARANG"]) {
           unmatchedAccByName.delete(matchedAcc["NAMA BARANG"].trim().toLowerCase());
        }

        if (upsertQueue.length >= BATCH_SIZE) {
          await flushQueue();
        }
      }
    }

    await flushQueue(); // flush remaining

    return NextResponse.json({ success: true, matched_count: results.length, results });

  } catch (error: any) {
    console.error("Automap CSV Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
