import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { parseProductName } from "@/lib/format";
import { serverEnv } from "@/lib/server-env";

async function wooFetchServer(endpoint: string, method = 'GET', data?: unknown, params?: Record<string, string | number | boolean>) {
  const apiUrl = new URL(`${serverEnv.WOO_URL}/wp-json/wc/v3/${endpoint}`);
  apiUrl.searchParams.set("consumer_key", serverEnv.WOO_CONSUMER_KEY);
  apiUrl.searchParams.set("consumer_secret", serverEnv.WOO_CONSUMER_SECRET);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      apiUrl.searchParams.set(k, String(v));
    }
  }
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  };
  if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
    opts.body = JSON.stringify(data);
  }
  const response = await fetch(apiUrl.toString(), opts);
  const responseText = await response.text();
  let responseData;
  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = { message: responseText };
  }
  if (!response.ok) {
    throw new Error(responseData.message || `WooCommerce API Error: ${response.status}`);
  }
  return responseData;
}

type AutomapRequest = {
  products: { kode: string; nama: string; brand?: string }[];
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

// Hitung kemiripan dua teks menggunakan Bigram (0 - 100) dan validasi Spek + Brand
function calculateSimilarity(accName: string, wooName: string, brand?: string) {
  const accParsed = parseProductName(accName);
  const wooParsed = parseProductName(wooName);

  const s1 = sanitize(accParsed.name);
  const s2 = sanitize(wooParsed.name);

  // 1. Filter Brand (Kepastian Pabrik)
  if (brand) {
    const wooFullSanitized = sanitize(wooName);
    const brandSanitized = sanitize(brand);
    if (brandSanitized.length > 2 && !wooFullSanitized.includes(brandSanitized)) {
      return 0; // Pasti beda pabrik
    }
  }

  // 2. Bigram Similarity pada Nama Bersih
  let baseScore = 0;
  if (s1 === s2) {
    baseScore = 100;
  } else if (s1 && s2) {
    function getBigrams(str: string) {
      const bigrams = [];
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.push(str.substring(i, i + 2));
      }
      return bigrams;
    }
    
    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    let intersection = 0;
    for (let i = 0; i < b1.length; i++) {
      const index = b2.indexOf(b1[i]);
      if (index !== -1) {
        intersection++;
        b2.splice(index, 1);
      }
    }
    const maxLen = Math.max(b1.length, getBigrams(s2).length);
    baseScore = maxLen === 0 ? 0 : Math.round((intersection / maxLen) * 100);
  }

  // 3. Validasi Silang Spesifikasi
  if (baseScore >= 40 && accParsed.specs) {
    const accSpecsArr = accParsed.specs.split('·').map(s => s.trim().toUpperCase()).filter(Boolean);
    const wooFullString = wooName.toUpperCase();
    
    let missingSpecs = 0;
    for (const spec of accSpecsArr) {
      // Hilangkan spasi di spec untuk pencarian lebih toleran (misal "16GB" vs "16 GB")
      const safeSpec = spec.replace(/\s+/g, '');
      const safeWoo = wooFullString.replace(/\s+/g, '');
      
      if (!safeWoo.includes(safeSpec)) {
        missingSpecs++;
      }
    }

    if (missingSpecs === 0) {
      baseScore = Math.min(100, baseScore + 15); // Bonus
    } else {
      baseScore = Math.max(0, baseScore - (missingSpecs * 20)); // Penalti berat per spek yang hilang
    }
  }

  return baseScore;
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
      const { kode, nama, brand } = p;
      let matched = false;
      const parsedAcc = parseProductName(nama);
      const searchName = parsedAcc.name || nama;

      try {
        // === IF 1: PENCARIAN SKU PERSIS ===
        const bySku = (await wooFetchServer("products", "GET", undefined, { sku: kode, per_page: 5 })) as any[];
        
        let foundWoo = null;
        let foundVariation = null;
        let isNeedsReview = false;
        let matchMethod = "";
        let confidenceScore = 100;

        if (bySku && bySku.length > 0) {
          // Ketemu berdasarkan SKU
          const wooProd = bySku[0];
          foundWoo = wooProd;
          matchMethod = "exact_sku";

          if (wooProd.type === "variable") {
            // Cari variasi mana yang SKU-nya cocok
            const vars = (await wooFetchServer(`products/${wooProd.id}/variations`, "GET", undefined, { per_page: 100 })) as any[];
            const exactVar = vars.find(v => v.sku === kode);
            if (exactVar) {
              foundVariation = exactVar;
            }
          }
        } 
        
        // === IF 2: PENCARIAN NAMA PERSIS ===
        if (!foundWoo) {
          // Cari 10 barang terdekat menggunakan nama bersih (searchName)
          const byName = (await wooFetchServer("products", "GET", undefined, { search: searchName, per_page: 10 })) as any[];
          if (byName && byName.length > 0) {
            // Cek apakah ada yang namanya benar-benar sama (setelah disanitize)
            const sanitizedTarget = sanitize(searchName);
            const exactMatch = byName.find(w => sanitize(parseProductName(w.name).name) === sanitizedTarget);
            
            if (exactMatch) {
              const sim = calculateSimilarity(nama, exactMatch.name, brand);
              if (sim >= 80) { // Verifikasi akhir menggunakan similarity cross-check
                foundWoo = exactMatch;
                matchMethod = "exact_name";
                confidenceScore = sim;
                if (sim < 100) isNeedsReview = true;
              }
            }
            
            if (!foundWoo) {
              // === IF 3: PENCARIAN FUZZY & SIMILARITY CHECK ===
              const keys = getUniqueKeywords(searchName);
              let candidate = null;

              if (keys.length > 3) {
                const byFuzzy = (await wooFetchServer("products", "GET", undefined, { search: keys, per_page: 5 })) as any[];
                if (byFuzzy && byFuzzy.length > 0) {
                  candidate = byFuzzy[0];
                  matchMethod = "fuzzy_keyword";
                }
              } 
              
              if (!candidate) {
                // Kalau keyword terlalu pendek atau gak ketemu, ambil aja hasil pencarian nama teratas
                candidate = byName[0];
                matchMethod = "fuzzy_name";
              }

              // Lakukan pengecekan kemiripan sebelum diterima
              if (candidate) {
                const sim = calculateSimilarity(nama, candidate.name, brand);
                if (sim >= 40) {
                  foundWoo = candidate;
                  isNeedsReview = sim < 100;
                  confidenceScore = sim;
                } else {
                  // Tolak jika kemiripan di bawah 40% (termasuk beda brand = 0)
                  foundWoo = null;
                }
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

          await supabase.from("product_woo_mapping").delete().eq("kode_accurate", kode);
          const { error } = await supabase.from("product_woo_mapping").insert({
            kode_accurate: kode,
            woo_product_id: foundWoo.id,
            woo_variation_id: foundVariation ? foundVariation.id : null,
            woo_name: finalName,
            woo_sku_full: finalSku,
            needs_review: isNeedsReview,
            is_active: true,
            triggered_by: triggered_by,
            confidence_score: confidenceScore,
            match_method: matchMethod
          });

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
