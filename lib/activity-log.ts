import { supabase } from "./supabase";
import { getActiveStore } from "./store";

export interface ActivityLogInput {
  action: string;
  product_id?: number;
  product_name?: string;
  field?: string;
  old_value?: string;
  new_value?: string;
}

/**
 * Insert an activity log row for the currently authenticated user.
 * Errors are swallowed so logging never blocks the UI.
 */
export async function logActivity(log: ActivityLogInput): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const store = getActiveStore();

    await supabase.from("activity_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      store_url: store?.url ?? "unknown",
      ...log,
    });
  } catch {
    // Never propagate — logging is best-effort
  }
}
