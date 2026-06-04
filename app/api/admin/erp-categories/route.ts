import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createServiceClient();
    
    // Fetch unique categories
    // Supabase JS doesn't have a distinct() method, but we can call a lightweight query
    // or just fetch all KATEGORI and deduplicate
    const { data, error } = await supabase
      .from("products")
      .select("KATEGORI");

    if (error) throw error;

    const uniqueCategories = Array.from(new Set(data.map(d => d.KATEGORI).filter(Boolean))).sort() as string[];

    return NextResponse.json({ categories: uniqueCategories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
