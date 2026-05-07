import { supabase } from "./supabase";

export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "active" | "rejected";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  full_name: string | null;
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
      .select("role, full_name, status")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      email: user.email ?? "",
      role: (profile?.role as UserRole) ?? "user",
      status: (profile?.status as UserStatus) ?? "active",
      full_name: profile?.full_name ?? null,
    };
  } catch {
    return null;
  }
}
