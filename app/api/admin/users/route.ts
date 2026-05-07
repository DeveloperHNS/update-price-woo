import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side admin client using service role key
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET — list all users with profile data
export async function GET() {
  try {
    const supabase = adminClient();

    // Fetch all auth users
    const { data: { users: authUsers }, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) throw authErr;

    // Fetch all profiles
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, pic_category");
    if (profileErr) throw profileErr;

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    const users = authUsers.map(u => ({
      id: u.id,
      email: u.email ?? "",
      full_name: profileMap[u.id]?.full_name ?? null,
      role: profileMap[u.id]?.role ?? "pic",
      status: profileMap[u.id]?.status ?? "pending",
      pic_category: profileMap[u.id]?.pic_category ?? null,
      created_at: u.created_at,
    }));

    // Sort: pending first, then active, then rejected
    const order = { pending: 0, active: 1, rejected: 2 };
    users.sort((a, b) => (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9));

    return NextResponse.json({ users });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// PATCH — update user status or role
export async function PATCH(req: NextRequest) {
  try {
    const { userId, status, role, pic_category } = await req.json() as {
      userId: string;
      status?: "pending" | "active" | "rejected";
      role?: "admin" | "pic";
      pic_category?: "komponen" | "aksesoris" | "laptop" | null;
    };

    if (!userId) return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 });

    const supabase = adminClient();
    const patch: Record<string, string | null> = {};
    if (status) patch.status = status;
    if (role) patch.role = role;
    if (pic_category !== undefined) patch.pic_category = pic_category;

    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
