import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { triggered_by } = await req.json();
    
    if (!triggered_by) {
      return NextResponse.json({ error: "Missing triggered_by" }, { status: 400 });
    }

    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from("product_woo_mapping")
      .delete()
      .eq("needs_review", true);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Reset berhasil" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
