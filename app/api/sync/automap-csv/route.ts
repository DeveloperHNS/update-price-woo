import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// --- FUNGSI KECERDASAN DARI FILE 2 ---

// Fungsi membersihkan teks untuk komparasi persis
function sanitize(str: string) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Hitung kemiripan dua teks menggunakan Bigram (0 - 100)
function calculateSimilarity(str1: string, str2: string) {
  const s1 = sanitize(str1);
  const s2 = sanitize(str2);
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
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
  if (maxLen === 0) return 0;
  return Math.round((intersection / maxLen) * 100);
}

// --- LOGIKA UTAMA ---

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wooProducts, triggered_by } = body;

    if (!wooProducts || !Array.isArray(wooProducts)) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Ambil data produk Accurate dari Supabase
    const { data: accProducts, error: errFetch } = await supabase
      .from("products")
      .select("*");

    if (errFetch || !accProducts) throw new Error("Failed to fetch accurate products: " + errFetch?.message);

    // 2. Ambil data mapping yang sudah ada
    const { data: mappings } = await supabase.from("product_woo_mapping").select("kode_accurate");
    const mappedKodes = new Set((mappings || []).map((m: any) => m.kode_accurate));
    
    // 3. Siapkan tempat penampungan sementara di Memori (Biar Cepat)
    const unmatchedAccByKode = new Map<string, any>();
    const unmatchedAccArray: any[] = []; // Array ini untuk pencarian Fuzzy Similarity
    
    for (const p of accProducts as any[]) {
      const kodeAcc = p["Kode Accurate"];
      if (kodeAcc && !mappedKodes.has(kodeAcc)) {
        unmatchedAccByKode.set(kodeAcc, p);
        unmatchedAccArray.push({
            ...p,
            sanitizedName: sanitize(p["NAMA BARANG"]) // Simpan nama yang sudah bersih
        });
      }
    }

    const results = [];
    const BATCH_SIZE = 50;
    let upsertQueue: any[] = [];

    // Fungsi untuk Push ke Database secara antrean (Batch)
    const flushQueue = async () => {
      if (upsertQueue.length > 0) {
        const kodes = upsertQueue.map(q => q.kode_accurate);
        await supabase.from("product_woo_mapping").delete().in("kode_accurate", kodes);
        const { error } = await supabase.from("product_woo_mapping").insert(upsertQueue);
        if (error) console.error("Error upserting batch", error);
        upsertQueue = [];
      }
    };

    // 4. Looping data CSV WooCommerce
    for (const woo of wooProducts) {
      const wooIdStr = woo.id;
      const wooTipe = woo.type;
      const wooSku = woo.sku;
      const wooNama = woo.name;
      const wooInduk = woo.parent;

      if (!wooIdStr || !wooNama) continue;

      let matchedAcc = null;
      let matchMethod = "";
      let confidenceScore = 0;
      let isNeedsReview = false;

      // === LOGIKA MATCHING GABUNGAN ===

      // IF 1: Pencarian berdasar SKU (Tingkat Kepercayaan 100%)
      if (wooSku) {
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
          matchMethod = "exact_sku";
          confidenceScore = 100;
        }
      }

      // IF 2: Pencarian Nama Persis Menggunakan Sanitize (Tingkat Kepercayaan 100%)
      if (!matchedAcc && wooNama) {
        const sanitizedWooName = sanitize(wooNama);
        const exactNameMatch = unmatchedAccArray.find(acc => acc.sanitizedName === sanitizedWooName);
        
        if (exactNameMatch) {
            matchedAcc = exactNameMatch;
            matchMethod = "exact_name";
            confidenceScore = 100;
        }
      }

      // IF 3: Pencarian Fuzzy/Kemiripan (Tingkat Kepercayaan >= 40%)
      if (!matchedAcc && wooNama) {
          let bestMatch = null;
          let highestScore = 0;

          // Cek kemiripan dengan semua produk Accurate yang belum ter-map
          for (const acc of unmatchedAccArray) {
              const score = calculateSimilarity(wooNama, acc["NAMA BARANG"]);
              if (score > highestScore) {
                  highestScore = score;
                  bestMatch = acc;
              }
          }

          if (bestMatch && highestScore >= 40) {
              matchedAcc = bestMatch;
              matchMethod = "fuzzy_similarity";
              confidenceScore = highestScore;
              isNeedsReview = true; // Jika pakai fuzzy, wajib masuk review
          }
      }

      // === JIKA KETEMU, MASUKKAN KE ANTRIAN DATABASE ===
      if (matchedAcc) {
        let wooProductId = parseInt(wooIdStr);
        let wooVariationId = null;

        if (wooTipe === "variation") {
          wooVariationId = wooProductId;
          if (wooInduk && wooInduk.includes("id:")) {
            wooProductId = parseInt(wooInduk.replace("id:", "").trim());
          }
        }

        const kodeAccurate = matchedAcc["Kode Accurate"];

        upsertQueue.push({
          kode_accurate: kodeAccurate,
          woo_product_id: wooProductId,
          woo_variation_id: wooVariationId,
          woo_name: wooNama,
          woo_sku_full: wooSku || "",
          needs_review: isNeedsReview,
          is_active: true,
          triggered_by: triggered_by || null,
          confidence_score: confidenceScore,
          match_method: matchMethod
        });

        results.push({
          kode: kodeAccurate,
          status: isNeedsReview ? "needs_review" : "matched",
          woo_name: wooNama,
          score: confidenceScore
        });

        // Hapus dari map/array agar tidak di-map dua kali oleh produk CSV lain
        unmatchedAccByKode.delete(kodeAccurate);
        const removeIndex = unmatchedAccArray.findIndex(acc => acc["Kode Accurate"] === kodeAccurate);
        if (removeIndex > -1) unmatchedAccArray.splice(removeIndex, 1);

        // Eksekusi antrean jika sudah mencapai 50
        if (upsertQueue.length >= BATCH_SIZE) {
          await flushQueue();
        }
      }
    }

    await flushQueue(); // Eksekusi sisa antrean terakhir

    return NextResponse.json({ success: true, matched_count: results.length, results });

  } catch (error: any) {
    console.error("Automap CSV Gabungan Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
