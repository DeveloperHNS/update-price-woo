import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  const body = await req.json();
  const { kode_accurate, woo_product_id, woo_variation_id, woo_name, woo_sku_full, triggered_by } = body as {
    kode_accurate: string;
    woo_product_id: number;
    woo_variation_id?: number | null;
    woo_name?: string;
    woo_sku_full?: string;
    triggered_by?: string;
  };

  if (!kode_accurate || !woo_product_id) {
    return NextResponse.json({ error: "kode_accurate and woo_product_id are required" }, { status: 400 });
  }

  // Deactivate any existing mapping for this kode_accurate
  await supabase
    .from("product_woo_mapping")
    .update({ is_active: false })
    .eq("kode_accurate", kode_accurate);

  // Insert new mapping
  const { data, error } = await supabase
    .from("product_woo_mapping")
    .insert({
      kode_accurate,
      woo_product_id,
      woo_variation_id: woo_variation_id ?? null,
      woo_name: woo_name ?? null,
      woo_sku_full: woo_sku_full ?? null,
      is_active: true,
      needs_review: false,
      match_method: "manual",
      confidence_score: 100,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log to sync_log
  await supabase.from("sync_log").insert({
    kode_accurate,
    woo_product_id,
    action: "map_product",
    status: "success",
    message: `Manual mapping: ${kode_accurate} → WC #${woo_product_id}`,
    triggered_by: triggered_by ?? null,
  });

  return NextResponse.json({ mapping: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(req.url);
  const kode_accurate = searchParams.get("kode_accurate");

  if (!kode_accurate) {
    return NextResponse.json({ error: "kode_accurate is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("product_woo_mapping")
    .update({ is_active: false })
    .eq("kode_accurate", kode_accurate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
