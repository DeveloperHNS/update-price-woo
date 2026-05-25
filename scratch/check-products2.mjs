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
  console.log("=== CHECKING PRODUCTS & MAPPINGS ===");
  try {
    const { data: p, error: pe } = await supabase.from("products").select("id, \"Kode Accurate\", \"KATEGORI\"").limit(5);
    console.log("Products count (sample):", p?.length || 0, pe ? pe.message : "");
    if (p?.length) console.log(p);

    const { data: m, error: me } = await supabase.from("product_woo_mapping").select("id").limit(5);
    console.log("Mappings count (sample):", m?.length || 0, me ? me.message : "");
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

check();
