import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST — cek apakah email sudah terdaftar di auth.users
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };
    if (!email) return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });

    const supabase = adminClient();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const exists = data.users.some(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    return NextResponse.json({ exists });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
