import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, parseAccuratePrice } from "@/lib/supabase-server";
import { serverEnv } from "@/lib/server-env";

function wooAuthHeader() {
  const token = Buffer.from(
    `${serverEnv.WOO_CONSUMER_KEY}:${serverEnv.WOO_CONSUMER_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function wooUpdate(endpoint: string, data: Record<string, unknown>) {
  const url = `${serverEnv.WOO_URL}/wp-json/wc/v3/${endpoint}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: wooAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `WooCommerce error ${res.status}`);
  return json;
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const body = await req.json();
  const { kode_accurate, triggered_by } = body as {
    kode_accurate: string;
    triggered_by?: string;
  };

  if (!kode_accurate) {
    return NextResponse.json({ error: "kode_accurate is required" }, { status: 400 });
  }

  // Fetch all products then find by kode_accurate in JS
  // (column name has a space so PostgREST .eq() is unreliable here)
  const { data: allProducts, error: prodErr } = await supabase.from("products").select("*");
  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }
  const product = (allProducts || []).find(
    (p: any) => p["Kode Accurate"] === kode_accurate
  );

  if (!product) {
    return NextResponse.json({ error: `Produk ${kode_accurate} tidak ditemukan di Supabase` }, { status: 404 });
  }

  const rawPrice = product["SP"];
  const priceStr = parseAccuratePrice(rawPrice);

  if (!priceStr) {
    return NextResponse.json({ error: `Harga SP untuk ${kode_accurate} kosong atau tidak valid` }, { status: 400 });
  }

  // Fetch mapping
  const { data: mapping, error: mapErr } = await supabase
    .from("product_woo_mapping")
    .select("*")
    .eq("kode_accurate", kode_accurate)
    .eq("is_active", true)
    .single();

  if (mapErr || !mapping) {
    return NextResponse.json({ error: `Mapping untuk ${kode_accurate} tidak ditemukan` }, { status: 404 });
  }

  const startTime = Date.now();

  try {
    const stok = typeof product["Stok Sistem"] === "number" ? product["Stok Sistem"] : 0;
    const wooPayload = { 
      regular_price: priceStr,
      manage_stock: true,
      stock_quantity: stok
    };

    // Sync to WooCommerce
    if (mapping.woo_variation_id) {
      await wooUpdate(
        `products/${mapping.woo_product_id}/variations/${mapping.woo_variation_id}`,
        wooPayload
      );
    } else {
      await wooUpdate(`products/${mapping.woo_product_id}`, wooPayload);
    }

    const duration = Date.now() - startTime;

    // Log success
    await supabase.from("sync_log").insert({
      kode_accurate,
      woo_product_id: mapping.woo_product_id,
      action: "sync_price",
      status: "success",
      message: `Harga & Stok disync: Rp ${priceStr} (Stok: ${stok})`,
      old_value: null,
      new_value: { regular_price: priceStr, stock_quantity: stok, source: "SP/Stok Sistem" },
      triggered_by: triggered_by ?? null,
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      kode_accurate,
      woo_product_id: mapping.woo_product_id,
      price_synced: priceStr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase.from("sync_log").insert({
      kode_accurate,
      woo_product_id: mapping.woo_product_id,
      action: "sync_price",
      status: "error",
      message: `Gagal sync harga`,
      error_detail: message,
      triggered_by: triggered_by ?? null,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
