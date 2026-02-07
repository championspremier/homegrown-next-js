"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUserWithProfile } from "@/lib/auth";

export type UpdateMyEmailResult =
  | { error: string; pending?: false; message?: never }
  | { error: null; pending: true; message: string }
  | { error: null; pending?: false; message?: never };

/**
 * Update the logged-in user's email in Auth and in public.profiles.
 * Only updates profiles.email when Auth has already set user.email (no pending confirmation).
 */
export async function updateMyEmail(newEmail: string): Promise<UpdateMyEmailResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.user) return { error: "Not authenticated" };

  const email = newEmail?.trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const { data: updateData, error: authError } = await supabase.auth.updateUser({ email });
  if (authError) return { error: authError.message };

  const currentAuthEmail = (updateData?.user?.email ?? result.user.email ?? "").trim().toLowerCase();
  if (currentAuthEmail !== email) {
    return {
      error: null,
      pending: true,
      message: "Email change requested. Check your inbox to confirm, then sign in again.",
    };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email })
    .eq("id", result.user.id);
  if (profileError) return { error: profileError.message };

  return { error: null };
}

type ProfileUpdate = { avatar_url?: string; full_name?: string | null; updated_at: string };

export async function updateProfileAvatar(userId: string, path: string) {
  const supabase = await createClient();
  const payload: ProfileUpdate = { avatar_url: path, updated_at: new Date().toISOString() };
  const table = supabase.from("profiles") as unknown as { update: (v: ProfileUpdate) => { eq: (col: string, id: string) => Promise<{ error: { message: string } | null }> } };
  const { error } = await table.update(payload).eq("id", userId);
  return { error: error?.message ?? null };
}

export async function updateProfileName(userId: string, fullName: string | null) {
  const supabase = await createClient();
  const payload: ProfileUpdate = { full_name: fullName, updated_at: new Date().toISOString() };
  const table = supabase.from("profiles") as unknown as { update: (v: ProfileUpdate) => { eq: (col: string, id: string) => Promise<{ error: { message: string } | null }> } };
  const { error } = await table.update(payload).eq("id", userId);
  return { error: error?.message ?? null };
}
