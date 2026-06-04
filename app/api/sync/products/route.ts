import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, PIC_CATEGORY_KEYWORDS, type AccurateProduct, type WooMapping } from "@/lib/supabase-server";

export type ProductWithStatus = AccurateProduct & {
  _mapping: WooMapping | null;
  _status: "unmatched" | "needs_review" | "matched";
};

export async function GET(req: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(req.url);
  const picCategory = searchParams.get("pic_category"); // komponen | laptop | aksesoris | null (admin = all)
  const tab = searchParams.get("tab") || "unmatched";   // unmatched | needs_review | matched

  // Fetch all active mappings
  const { data: mappings, error: mappingErr } = await supabase
    .from("product_woo_mapping")
    .select("*")
    .eq("is_active", true);

  if (mappingErr) {
    return NextResponse.json({ error: mappingErr.message }, { status: 500 });
  }

  const mappingByKode = new Map<string, WooMapping>();
  for (const m of (mappings as WooMapping[]) || []) {
    mappingByKode.set(m.kode_accurate, m);
  }

  // Build products query — filter by KATEGORI based on PIC role
  let allProducts: AccurateProduct[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    let query = supabase.from("products").select("*").range(from, from + step - 1);

    if (picCategory) {
      let erpCategories: string[] = [];
      try {
        if (picCategory.startsWith("{")) {
          const parsed = JSON.parse(picCategory);
          if (parsed.erp === "ALL") {
            erpCategories = []; // no filter
          } else if (parsed.erp) {
            erpCategories = parsed.erp.split(",").map((s: string) => s.trim());
          } else {
             // they have no erp categories assigned
            erpCategories = ["__NONE__"];
          }
        } else {
          // old format or ALL
          if (picCategory === "ALL") {
            erpCategories = [];
          } else {
            // fallback for old pic_category which mapped to PIC_CATEGORY_KEYWORDS
            const oldCategories = picCategory.split(",").map((s: string) => s.trim());
            for (const cat of oldCategories) {
              if (PIC_CATEGORY_KEYWORDS[cat]) {
                erpCategories.push(...PIC_CATEGORY_KEYWORDS[cat]);
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }

      if (erpCategories.length > 0) {
        if (erpCategories.includes("__NONE__")) {
           query = query.eq("KATEGORI", "__NONE__");
        } else {
           const orFilter = erpCategories.map((k) => `KATEGORI.ilike.%${k}%`).join(",");
           query = query.or(orFilter);
        }
      }
    }

    const { data: products, error: prodErr } = await query;

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    const batch = (products as AccurateProduct[]) || [];
    allProducts = allProducts.concat(batch);

    if (batch.length < step) {
      break;
    }
    from += step;
  }

  const withStatus: ProductWithStatus[] = allProducts.map((p) => {
    const kode = p["Kode Accurate"] ?? "";
    const mapping = mappingByKode.get(kode) ?? null;
    let status: ProductWithStatus["_status"] = "unmatched";
    if (mapping) {
      status = mapping.needs_review ? "needs_review" : "matched";
    }
    return { ...p, _mapping: mapping, _status: status };
  });

  const filtered = tab === "all"
    ? withStatus
    : withStatus.filter((p) => p._status === tab);

  // Counts for all tabs
  const counts = {
    unmatched: withStatus.filter((p) => p._status === "unmatched").length,
    needs_review: withStatus.filter((p) => p._status === "needs_review").length,
    matched: withStatus.filter((p) => p._status === "matched").length,
  };

  return NextResponse.json({ products: filtered, counts });
}
