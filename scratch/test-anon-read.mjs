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
const SUPABASE_ANON_KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

const ADMIN_EMAIL = env["ADMIN_EMAIL"] || "admin@hnsitcenter.id";
const ADMIN_PASSWORD = env["ADMIN_PASSWORD"] || "Admin@12345";

// Initialize using ANON key (like the frontend browser client)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("=== TESTING ANON READ WITH AUTH ===");
  console.log(`Logging in as: ${ADMIN_EMAIL}...`);

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (authError) {
    console.error("❌ Login failed:", authError.message);
    process.exit(1);
  }

  const user = authData.user;
  console.log(`✅ Login success! User ID: ${user.id}`);

  console.log("\nAttempting to query profiles table for this user...");
  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profError) {
    console.error("❌ Profile read failed:", profError.message);
    console.error("Full error object:", JSON.stringify(profError, null, 2));
  } else {
    console.log("✅ Profile read success!");
    console.log("Profile data:", JSON.stringify(profile, null, 2));
  }

  // Sign out to clean up session
  await supabase.auth.signOut();
}

main();
