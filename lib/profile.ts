import { supabase } from "./supabase";

export type UserRole = "admin" | "pic" | "product_staff";
export type UserStatus = "pending" | "active" | "rejected";
export type PicCategory = "komponen" | "aksesoris" | "laptop" | "dealer";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  full_name: string | null;
  pic_category: string | null;
}

export interface CategoryAccess {
  woo: string | "ALL" | null;
  erp: string | "ALL" | null;
}

export function parseCategoryAccess(raw: string | null): CategoryAccess {
  if (!raw) return { woo: null, erp: null };
  if (raw === "ALL") return { woo: "ALL", erp: "ALL" };
  
  try {
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        woo: parsed.woo ?? null,
        erp: parsed.erp ?? null
      };
    }
  } catch (e) {
    // ignore
  }

  // Fallback for old comma-separated woo categories
  return { woo: raw, erp: null };
}

/**
 * Fetch the current authenticated user's profile (email + role + status).
 * Returns null if not authenticated.
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, status, pic_category")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? "",
      role: (profile?.role as UserRole) ?? "pic",
      status: (profile?.status as UserStatus) ?? "pending",
      full_name: profile?.full_name ?? null,
      pic_category: profile?.pic_category ?? null,
    };
  } catch {
    return null;
  }
}
