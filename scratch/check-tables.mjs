import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
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
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log("=== SUPABASE TABLE INSPECTOR ===\n");

  // List all tables in public schema
  const { data: tables, error: tablesErr } = await supabase
    .rpc("list_tables_and_columns");

  if (tablesErr) {
    // Fallback: query information_schema directly
    const { data: rawTables, error: rawErr } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE");

    if (rawErr) {
      console.log("Tidak bisa query information_schema langsung, coba cara lain...\n");

      // Try querying known table names to see which exist
      const candidates = [
        "profiles", "users", "products", "product_woo_mapping", "sync_log", "activity_logs", "harga", "prices",
        "sheet_products", "product_mappings", "produk", "barang",
        "katalog", "logs", "stores",
        "categories", "brands", "items", "inventory"
      ];

      console.log("Mengecek tabel-tabel yang mungkin ada:\n");
      for (const tbl of candidates) {
        const { data, error } = await supabase.from(tbl).select("*").limit(1);
        if (!error) {
          const cols = data && data.length > 0 ? Object.keys(data[0]).join(", ") : "(kosong)";
          console.log(`✅ ${tbl} — kolom: ${cols}`);
        } else if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
          console.log(`⚠️  ${tbl} — error: ${error.message}`);
        }
      }
    } else {
      console.log("Tabel yang ditemukan:", rawTables?.map(t => t.table_name));
    }
  } else {
    console.log("Tabel:", tables);
  }

  // Always check profiles to confirm connection works
  console.log("\n--- profiles ---");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("*")
    .limit(3);
  if (profErr) console.error("Error:", profErr.message);
  else {
    console.log(`${profiles.length} baris ditemukan`);
    if (profiles.length > 0) console.log("Kolom:", Object.keys(profiles[0]).join(", "));
    console.log(JSON.stringify(profiles, null, 2));
  }
}

main();
