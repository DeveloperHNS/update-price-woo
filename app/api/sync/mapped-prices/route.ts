import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, type AccurateProduct, type WooMapping } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  
  try {
    const body = await req.json();
    const { woo_ids } = body as { woo_ids: number[] };

    if (!woo_ids || !Array.isArray(woo_ids) || woo_ids.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    // 1. Fetch active mappings where woo_product_id OR woo_variation_id is in woo_ids
    const { data: mappings, error: mapErr } = await supabase
      .from("product_woo_mapping")
      .select("*")
      .eq("is_active", true);

    if (mapErr) {
      return NextResponse.json({ error: mapErr.message }, { status: 500 });
    }

    const relevantMappings = ((mappings as WooMapping[]) || []).filter(m => 
      woo_ids.includes(m.woo_product_id) || 
      (m.woo_variation_id && woo_ids.includes(m.woo_variation_id))
    );

    if (relevantMappings.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    // 2. Fetch all products to get CP and PRICE
    // (column name has space so .in() is unreliable, fetching all is fast enough for caching)
    const { data: allProducts, error: prodErr } = await supabase
      .from("products")
      .select("*");

    if (prodErr) {
      return NextResponse.json({ error: prodErr.message }, { status: 500 });
    }

    const productMap = new Map<string, AccurateProduct>();
    for (const p of (allProducts as AccurateProduct[]) || []) {
      if (p["Kode Accurate"]) {
        productMap.set(p["Kode Accurate"], p);
      }
    }

    // 3. Build response mapping
    // Format: { [woo_id]: { cp: string, price: string, sp: string } }
    const result: Record<number, { cp: string | null; price: string | null; sp: string | null }> = {};

    for (const m of relevantMappings) {
      const accurateProd = productMap.get(m.kode_accurate);
      if (accurateProd) {
        const targetId = m.woo_variation_id || m.woo_product_id;
        result[targetId] = {
          cp: accurateProd["CP"] || null,
          price: accurateProd["PRICE"] || null,
          sp: accurateProd["SP"] || null,
        };
      }
    }

    return NextResponse.json({ prices: result });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
