import { createClient } from "@/lib/supabase/server";

export const ACTIVE_PROFILE_COOKIE = "hg_active_profile";

/**
 * Returns the active profile id from cookie, or auth user id when cookie is missing/blank.
 * No database queries. Returns null when unauthenticated.
 */
export async function getActiveProfileIdFromCookies(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value?.trim() ?? "";

  if (!raw) return user.id;
  return raw;
}

export type ActiveProfile = { id: string; full_name: string | null; email: string | null; role: string };

export type ProfileRow = { id: string; full_name?: string | null; email?: string | null; role?: string };

/** Normalize get_active_profile_by_id RPC return: can be single object or array of rows. */
export function normalizeRpcProfileRow(data: unknown): ProfileRow | null {
  if (data == null) return null;
  if (Array.isArray(data)) return data.length > 0 ? (data[0] as ProfileRow) : null;
  return data as ProfileRow;
}

/** Map RPC row to ActiveProfile. */
function toActiveProfile(row: ProfileRow): ActiveProfile {
  return {
    id: row.id,
    full_name: row.full_name ?? null,
    email: row.email ?? null,
    role: (row.role ?? "parent") as string,
  };
}

/**
 * Returns the profile row for the current active profile id, validated via get_active_profile_by_id RPC only.
 * Handles RPC return as object or array. When cookie points to a linked profile, RPC returns it; else falls back to self.
 * Returns null when unauthenticated.
 */
export async function getActiveProfile(): Promise<ActiveProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const activeId = await getActiveProfileIdFromCookies();
  const effectiveId = (activeId ?? "").trim() || user.id;

  const { data } = await supabase.rpc("get_active_profile_by_id", { p_id: effectiveId });
  const row = normalizeRpcProfileRow(data);

  if (row) return toActiveProfile(row);

  if (effectiveId !== user.id) {
    const { data: selfData } = await supabase.rpc("get_active_profile_by_id", { p_id: user.id });
    const selfRow = normalizeRpcProfileRow(selfData);
    if (selfRow) return toActiveProfile(selfRow);

    const { data: selfProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();
    if (selfProfile) return toActiveProfile(selfProfile as ProfileRow);
  }

  return null;
}
