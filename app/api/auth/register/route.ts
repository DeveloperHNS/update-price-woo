import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password } = await req.json() as {
      fullName: string;
      email: string;
      password: string;
    };

    if (!fullName?.trim()) return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
    if (!email?.trim())    return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });
    if (!password || password.length < 8) return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });

    const supabase = adminClient();

    // 1. Cek apakah email sudah terdaftar
    const { data: existing } = await supabase.auth.admin.listUsers();
    const emailExists = existing?.users?.some(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (emailExists) {
      return NextResponse.json(
        { error: "Email ini sudah terdaftar. Jika sudah mendaftar sebelumnya, tunggu persetujuan admin atau hubungi administrator." },
        { status: 409 }
      );
    }

    // 2. Buat user di auth.users pakai service role
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // langsung confirmed, tidak perlu verifikasi email
    });
    if (createErr) throw createErr;

    const userId = newUser.user?.id;
    if (!userId) throw new Error("Gagal membuat akun.");

    // 3. Buat profil dengan status pending — service role bypass RLS
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName.trim(),
      role: "pic",
      status: "pending",
      pic_category: null,
    });
    if (profileErr) {
      // Rollback: hapus user yang baru dibuat kalau profil gagal
      await supabase.auth.admin.deleteUser(userId);
      throw profileErr;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mendaftar.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
