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
  console.log("=== LIST ALL RLS POLICIES ON profiles ===\n");

  const { data, error } = await supabase.rpc("exec_sql", {
    query: `
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'profiles'
      ORDER BY policyname;
    `
  });

  if (error) {
    // Fallback: direct query via REST
    console.log("RPC not available, trying raw SQL via REST...\n");

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: `SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles' ORDER BY policyname;`
      }),
    });

    if (!res.ok) {
      console.log("RPC also failed. Trying pg_catalog directly...\n");

      // Try querying pg_policies as a table (may fail due to RLS, but service_role should bypass)
      const res2 = await fetch(
        `${SUPABASE_URL}/rest/v1/?select=*&on_conflict=id`,
        {
          method: "GET",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      );
      console.log("Trying alternative approach with raw SQL via PostgREST...");
      
      // Use the Supabase Management API or raw postgres query
      // Since we can't easily query pg_policies via PostgREST, let's create a helper function
      const createFnRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_profiles_policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: "{}",
      });

      if (!createFnRes.ok) {
        const errText = await createFnRes.text();
        console.log("Cannot list policies via RPC. Error:", errText);
        console.log("\n💡 Please run this SQL manually in Supabase SQL Editor:");
        console.log(`
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
        `);
      } else {
        const result = await createFnRes.json();
        console.log("Policies:", JSON.stringify(result, null, 2));
      }
    } else {
      const result = await res.json();
      console.log("Policies:", JSON.stringify(result, null, 2));
    }
  } else {
    console.log("Policies:", JSON.stringify(data, null, 2));
  }

  // Also check if check_is_admin function exists
  console.log("\n=== CHECK IF check_is_admin() FUNCTION EXISTS ===\n");
  const fnRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_is_admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: "{}",
  });
  
  if (fnRes.ok) {
    const fnResult = await fnRes.json();
    console.log("check_is_admin() exists and returned:", fnResult);
  } else {
    const errText = await fnRes.text();
    console.log("check_is_admin() status:", fnRes.status);
    console.log("Response:", errText);
  }
}

main();
