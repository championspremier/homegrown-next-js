"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserWithProfile } from "@/lib/auth";
import { getRoleHome } from "@/lib/role";
import { ACTIVE_PROFILE_COOKIE, normalizeRpcProfileRow } from "@/lib/active-profile";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Shared cookie options so hg_active_profile works (path=/, secure in prod). */
const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export type LinkedProfile = { id: string; full_name: string | null; email: string | null; role: string };

export type GetLinkedAccountsResult =
  | { error: string; self: null; linked: null }
  | { error: null; self: LinkedProfile; linked: LinkedProfile[] };

/**
 * Returns self profile and linked accounts via get_linked_profiles RPC (SECURITY DEFINER),
 * so linked profiles are visible without relaxing profiles RLS.
 * Auth required.
 */
export async function getLinkedAccounts(): Promise<GetLinkedAccountsResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated", self: null, linked: null };

  const selfProfile: LinkedProfile = {
    id: result.profile.id,
    full_name: result.profile.full_name ?? null,
    email: result.profile.email ?? null,
    role: result.profile.role ?? "parent",
  };

  const supabase = await createClient();
  const { data: rows, error: rpcError } = await supabase.rpc("get_linked_profiles");

  if (rpcError) return { error: rpcError.message, self: null, linked: null };

  const raw = Array.isArray(rows) ? rows : [];
  const linked: LinkedProfile[] = raw.map((p: { id: string; full_name: string | null; email: string | null; role: string }) => ({
    id: p.id,
    full_name: p.full_name ?? null,
    email: p.email ?? null,
    role: p.role ?? "parent",
  }));

  return { error: null, self: selfProfile, linked };
}

export type LinkPlayerResult = { error: string | null };

/**
 * Parent (or admin) links a player by email. Uses find_player_profile_by_email RPC
 * (SECURITY DEFINER) so lookup works without relaxing profiles RLS.
 * Duplicate returns friendly message.
 */
export async function linkPlayerToParentByEmail(playerEmail: string): Promise<LinkPlayerResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };

  const role = (result.profile.role ?? "parent").toLowerCase();
  if (role !== "parent" && role !== "admin") return { error: "Only parents (or admins) can link players." };

  const email = (playerEmail ?? "").trim().toLowerCase();
  if (!email) return { error: "Player email is required." };

  const supabase = await createClient();
  const { data: rows, error: rpcError } = await supabase.rpc("find_player_profile_by_email", {
    p_email: email,
  });

  if (rpcError) return { error: rpcError.message };
  const player = Array.isArray(rows) ? rows[0] : null;
  if (!player?.id) return { error: "No player account found with that email." };

  const parentId = result.profile.id;
  const { data: existing } = await supabase
    .from("parent_player_relationships")
    .select("parent_id")
    .eq("parent_id", parentId)
    .eq("player_id", player.id)
    .limit(1)
    .maybeSingle();

  if (existing) return { error: "This player is already linked to your account." };

  const { error: insertError } = await supabase
    .from("parent_player_relationships")
    .insert({ parent_id: parentId, player_id: player.id });

  if (insertError) {
    const isDuplicate = insertError.code === "23505";
    return { error: isDuplicate ? "This player is already linked to your account." : insertError.message };
  }
  return { error: null };
}

export type SetActiveProfileResult = { error: string | null };

/**
 * Sets active profile cookie if permitted: self or linked via parent_player_relationships.
 */
export async function setActiveProfile(profileId: string): Promise<SetActiveProfileResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };

  const id = profileId?.trim();
  if (!id) return { error: "Invalid profile." };

  const uid = result.profile.id;
  if (id === uid) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_PROFILE_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE });
    return { error: null };
  }

  const supabase = await createClient();
  const { data: rel } = await supabase
    .from("parent_player_relationships")
    .select("parent_id, player_id")
    .or(`and(parent_id.eq.${uid},player_id.eq.${id}),and(parent_id.eq.${id},player_id.eq.${uid})`)
    .limit(1)
    .maybeSingle();

  if (!rel) return { error: "You can only switch to your own account or a linked account." };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE });
  return { error: null };
}

/**
 * Server action for account switcher form. Sets hg_active_profile and redirect() to role home.
 * Call via <form action={switchActiveProfileAction}> with <select name="profileId">.
 */
export async function switchActiveProfileAction(formData: FormData): Promise<never> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) redirect("/login");

  const raw = formData.get("profileId");
  const id = (typeof raw === "string" ? raw : "").trim();
  if (!id) redirect("/login");

  const uid = result.profile.id;
  let role: string;

  if (id === uid) {
    role = (result.profile.role ?? "parent").toLowerCase().trim();
  } else {
    const supabase = await createClient();
    const { data: rel } = await supabase
      .from("parent_player_relationships")
      .select("parent_id, player_id")
      .or(`and(parent_id.eq.${uid},player_id.eq.${id}),and(parent_id.eq.${id},player_id.eq.${uid})`)
      .limit(1)
      .maybeSingle();

    if (!rel) redirect("/login");

    const { data: profileData } = await supabase.rpc("get_active_profile_by_id", { p_id: id });
    const profileRow = normalizeRpcProfileRow(profileData);
    if (!profileRow) redirect("/login");
    role = (profileRow.role ?? "parent").toLowerCase().trim();
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, id, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE });
  redirect(getRoleHome(role));
}

/**
 * Clears active profile cookie so active becomes auth.uid().
 * Uses same path/sameSite so the cookie is reliably removed.
 */
export async function clearActiveProfile(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

/**
 * Signs out and clears hg_active_profile, then redirects to /login.
 * Use this for the Sign out button so stale cookie never affects post-logout.
 */
export async function signOutAndClearProfile(): Promise<never> {
  await clearActiveProfile();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
