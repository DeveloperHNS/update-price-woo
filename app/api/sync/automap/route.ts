import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { wooFetch } from "@/lib/api";

type AutomapRequest = {
  products: { kode: string; nama: string }[];
  triggered_by: string;
};

// Fungsi membersihkan teks untuk komparasi persis (hapus spasi & karakter unik)
function sanitize(str: string) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Mengambil kata kunci unik (misal hapus "Laptop", "Mouse", brand umum)
function getUniqueKeywords(name: string) {
  const stops = ["laptop", "mouse", "kabel", "adaptor", "charger", "baterai", "keyboard", "lcd", "led", "asus", "acer", "lenovo", "hp", "dell", "macbook", "ram", "ssd", "hdd", "original", "ori", "oem"];
  const words = (name || "").split(/\s+/).filter(w => w.length > 2);
  const uniques = words.filter(w => !stops.includes(w.toLowerCase()));
  return uniques.slice(0, 2).join(" "); // Ambil 2 kata terpenting
}

export async function POST(req: NextRequest) {
  try {
    const { products, triggered_by } = (await req.json()) as AutomapRequest;
    if (!products || products.length === 0) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const results = [];

    for (const p of products) {
      const { kode, nama } = p;
      let matched = false;

      try {
        // === IF 1: PENCARIAN SKU PERSIS ===
        const bySku = (await wooFetch("products", "GET", undefined, { sku: kode, per_page: 5 })) as any[];
        
        let foundWoo = null;
        let foundVariation = null;
        let isNeedsReview = false;

        if (bySku && bySku.length > 0) {
          // Ketemu berdasarkan SKU
          const wooProd = bySku[0];
          foundWoo = wooProd;

          if (wooProd.type === "variable") {
            // Cari variasi mana yang SKU-nya cocok
            const vars = (await wooFetch(`products/${wooProd.id}/variations`, "GET", undefined, { per_page: 100 })) as any[];
            const exactVar = vars.find(v => v.sku === kode);
            if (exactVar) {
              foundVariation = exactVar;
            }
          }
        } 
        
        // === IF 2: PENCARIAN NAMA PERSIS ===
        if (!foundWoo) {
          // Cari 10 barang terdekat berdasarkan nama
          const byName = (await wooFetch("products", "GET", undefined, { search: nama, per_page: 10 })) as any[];
          if (byName && byName.length > 0) {
            // Cek apakah ada yang namanya benar-benar sama (setelah disanitize)
            const sanitizedTarget = sanitize(nama);
            const exactMatch = byName.find(w => sanitize(w.name) === sanitizedTarget);
            
            if (exactMatch) {
              foundWoo = exactMatch;
            } else {
              // === IF 3: PENCARIAN FUZZY (KATA KUNCI UNIK) ===
              const keys = getUniqueKeywords(nama);
              if (keys.length > 3) {
                const byFuzzy = (await wooFetch("products", "GET", undefined, { search: keys, per_page: 5 })) as any[];
                if (byFuzzy && byFuzzy.length > 0) {
                  foundWoo = byFuzzy[0];
                  isNeedsReview = true; // Ragu-ragu, masukkan ke Needs Review
                }
              } else {
                // Kalau keyword terlalu pendek, ambil aja hasil pencarian nama teratas tapi Needs Review
                foundWoo = byName[0];
                isNeedsReview = true;
              }
            }
          }
        }

        // === SIMPAN KE DATABASE JIKA KETEMU ===
        if (foundWoo) {
          let finalName = foundWoo.name;
          let finalSku = foundWoo.sku;
          
          if (foundVariation) {
            const attrLabels = (foundVariation.attributes || []).map((a: any) => `${a.name}: ${a.option}`).join(", ");
            finalName = `${foundWoo.name} (${attrLabels})`;
            finalSku = foundVariation.sku;
          }

          const { error } = await supabase.from("product_woo_mapping").upsert({
            kode_accurate: kode,
            woo_product_id: foundWoo.id,
            woo_variation_id: foundVariation ? foundVariation.id : null,
            woo_name: finalName,
            woo_sku_full: finalSku,
            needs_review: isNeedsReview,
            is_active: true,
            triggered_by: triggered_by
          }, { onConflict: "kode_accurate" });

          if (!error) {
            matched = true;
            results.push({ kode, status: isNeedsReview ? "needs_review" : "matched", woo_name: finalName });
          } else {
            results.push({ kode, status: "error", error: error.message });
          }
        } else {
          results.push({ kode, status: "unmatched" });
        }

      } catch (err: any) {
        results.push({ kode, status: "error", error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
