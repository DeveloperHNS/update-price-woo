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
  console.log("=== ACTIVATING ADMIN PROFILE ===");
  
  const adminId = "92534375-9e38-4e90-83fd-8060c0480a9f";
  
  console.log(`Updating profile status for admin ID ${adminId} to 'active'...`);
  
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", adminId)
    .select();
    
  if (error) {
    console.error("❌ Failed to update status:", error.message);
  } else {
    console.log("✅ Admin profile successfully activated!");
    console.log("Updated data:", JSON.stringify(data, null, 2));
  }
}

main();
