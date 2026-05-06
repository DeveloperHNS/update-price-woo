/**
 * Script untuk membuat akun admin pertama di Supabase.
 * Jalankan SEKALI saja:
 *
 *   node scripts/create-admin.mjs
 *
 * Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diisi di .env.local sebelum menjalankan ini.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

let envContent;
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error("❌  Tidak bisa membaca .env.local. Pastikan file ada di root project.");
  process.exit(1);
}

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

const SUPABASE_URL      = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY  = env["SUPABASE_SERVICE_ROLE_KEY"];

// ─── Config akun admin ────────────────────────────────────────────────────────
const ADMIN_EMAIL    = env["ADMIN_EMAIL"]    || "admin@hnsitcenter.id";
const ADMIN_PASSWORD = env["ADMIN_PASSWORD"] || "Admin@12345";
const ADMIN_NAME     = env["ADMIN_NAME"]     || "Administrator";

// ─── Validasi ─────────────────────────────────────────────────────────────────
if (!SUPABASE_URL) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL tidak ditemukan di .env.local");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "your-service-role-key-here") {
  console.error(`
❌  SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local!

Cara mendapatkannya:
  1. Buka https://supabase.com/dashboard
  2. Pilih project kamu
  3. Klik Settings (ikon roda gigi) → API
  4. Di bagian "Project API keys", copy key "service_role" (yang ada tulisan secret)
  5. Tambahkan ke .env.local:
     SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

Lalu jalankan script ini lagi.
`);
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log(`\n🚀  Membuat akun admin...`);
console.log(`   Email    : ${ADMIN_EMAIL}`);
console.log(`   Nama     : ${ADMIN_NAME}`);
console.log(`   Supabase : ${SUPABASE_URL}\n`);

const headers = {
  "Content-Type": "application/json",
  "apikey": SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
};

// 1. Buat user via Admin API (bypass email confirmation)
let userId;
try {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,  // langsung confirmed, tidak perlu klik email
      user_metadata: { full_name: ADMIN_NAME },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data?.msg?.includes("already been registered") || data?.message?.includes("already exists")) {
      console.log("⚠️   User sudah ada, mencoba update role ke admin...");
      // Cari user yang sudah ada
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`, { headers });
      const listData = await listRes.json();
      userId = listData?.users?.[0]?.id;
      if (!userId) throw new Error("Tidak bisa menemukan user yang sudah ada: " + JSON.stringify(listData));
    } else {
      throw new Error(data?.msg || data?.message || JSON.stringify(data));
    }
  } else {
    userId = data.id;
    console.log(`✅  User berhasil dibuat. ID: ${userId}`);
  }
} catch (err) {
  console.error("❌  Gagal membuat user:", err.message);
  process.exit(1);
}

// 2. Upsert profile dengan role = 'admin'
try {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      ...headers,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: userId,
      role: "admin",
      full_name: ADMIN_NAME,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HTTP ${res.status}: ${errBody}`);
  }

  console.log(`✅  Role admin berhasil di-set untuk ${ADMIN_EMAIL}`);
} catch (err) {
  console.error("❌  Gagal set role admin:", err.message);
  console.log("\n💡  Alternatif manual:");
  console.log(`   Supabase → Table Editor → profiles → cari user ${ADMIN_EMAIL} → ubah role = 'admin'`);
  process.exit(1);
}

console.log(`
🎉  Selesai! Akun admin siap dipakai:
   Email    : ${ADMIN_EMAIL}
   Password : ${ADMIN_PASSWORD}
   Role     : admin

⚠️  Segera ganti password setelah login pertama!
`);
