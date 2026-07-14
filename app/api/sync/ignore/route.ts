import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { kode_accurate, action, triggered_by } = await req.json();

    if (!kode_accurate || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (action === "ignore") {
      await supabase.from("product_woo_mapping").delete().eq("kode_accurate", kode_accurate);
      const { error } = await supabase.from("product_woo_mapping").insert({
        kode_accurate,
        woo_product_id: 0,
        woo_variation_id: null,
        woo_name: "IGNORED",
        woo_sku_full: "",
        needs_review: false,
        is_active: false,
        triggered_by: triggered_by || null,
        confidence_score: 100,
        match_method: "manual_ignore"
      });

      if (error) throw error;
    } else if (action === "restore") {
      // Just delete the mapping so it becomes unmatched again
      const { error } = await supabase.from("product_woo_mapping")
        .delete()
        .eq("kode_accurate", kode_accurate);

      if (error) throw error;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Ignore API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
