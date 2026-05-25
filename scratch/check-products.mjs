import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf8");

function parseEnv(content) {
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

const env = parseEnv(envContent);
const supabase = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]);

async function check() {
  console.log("=== CHECKING DATABASE PRODUCTS ===");
  try {
    const { data: m, error: me } = await supabase.from("product_mappings").select("id, category").limit(10);
    console.log("Product Mappings:", m?.length || 0, me ? "Error: " + me.message : "");
    if (m?.length) console.log("Categories found:", [...new Set(m.map(x => x.category))]);

    const { data: w, error: we } = await supabase.from("woocommerce_products").select("id, name, categories").limit(5);
    console.log("WooCommerce Products:", w?.length || 0, we ? "Error: " + we.message : "");
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

check();
