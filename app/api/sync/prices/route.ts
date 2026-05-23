import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function PUT(req: NextRequest) {
  const supabase = createServiceClient();
  
  try {
    const body = await req.json();
    const { updates } = body as {
      // updates is an array of objects: { kode_accurate, cp, price }
      updates: { kode_accurate: string; cp: string; price: string }[];
    };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid updates payload" }, { status: 400 });
    }

    let successCount = 0;
    const errors: string[] = [];

    // Loop through updates and upsert
    // Since column name has space, we construct the update object properly
    for (const update of updates) {
      if (!update.kode_accurate) continue;

      const record = {
        "Kode Accurate": update.kode_accurate,
        "CP": update.cp,
        "PRICE": update.price,
      };

      const { error } = await supabase
        .from("products")
        .upsert(record, { onConflict: "Kode Accurate" });

      if (error) {
        errors.push(`${update.kode_accurate}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updated: successCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
