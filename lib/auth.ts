import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRoleHome } from "@/lib/role";

/** Dev sanity check: ensures auth module exports are resolvable. */
export const __authExportsOk = true;

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export type ProfileWithRole = { id: string; email: string | null; full_name: string | null; role: string };

/** Synthetic profile when DB row is missing; used so callers always get a role. */
function syntheticProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): ProfileWithRole {
  const full_name = (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? null;
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: full_name ?? null,
    role: "parent",
  };
}

/**
 * Returns auth user and profile row. Profile is always fetched by user.id (auth.uid()) only;
 * we never fetch or match by email. Do not assume profile.email === user.email (e.g. after email-change flow).
 */
export async function getAuthUserWithProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  let { data: profileData } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  let profile = profileData as ProfileWithRole | null;

  if (!profile) {
    try {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? null,
        full_name: (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? null,
        role: "parent",
      });
      const { data: refetched } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", user.id)
        .single();
      profile = refetched as ProfileWithRole | null;
    } catch {
      // RLS or conflict; use synthetic so we don't send user to /login
    }
    if (!profile) profile = syntheticProfile(user);
  } else if (profile.role == null || profile.role === "") {
    profile = { ...profile, role: "parent" };
  }

  return { user, profile };
}

/** Use in role layouts: redirect to login if not authed, then redirect to correct role home if role mismatch. */
export async function requireRole(expectedRole: "parent" | "player" | "coach" | "admin") {
  const result = await getAuthUserWithProfile();
  if (!result) redirect("/login");
  const { user, profile } = result;
  const role = (profile?.role ?? "parent").toLowerCase();
  if (role !== expectedRole) redirect(getRoleHome(role));
  return { user, profile: profile ?? syntheticProfile(user) };
}

/**
 * Use in parent/player layouts with account switching: require auth, resolve active profile (cookie),
 * redirect if active profile role does not match this layout. Returns auth user, auth profile, and active profile.
 * If active profile cannot be loaded (e.g. new user, profile row not yet visible), uses auth user's profile.
 */
async function requireActiveRoleImpl(expectedRole: "parent" | "player") {
  const result = await getAuthUserWithProfile();
  if (!result) redirect("/login");
  const { getActiveProfile } = await import("@/lib/active-profile");
  let activeProfile = await getActiveProfile();
  if (!activeProfile) {
    const p = result.profile ?? syntheticProfile(result.user);
    activeProfile = { id: p.id, full_name: p.full_name ?? null, email: p.email ?? null, role: p.role ?? "parent" };
  }
  const activeRole = (activeProfile.role ?? "parent").toLowerCase();
  if (activeRole !== expectedRole) redirect(getRoleHome(activeRole));
  return {
    user: result.user,
    profile: result.profile ?? syntheticProfile(result.user),
    activeProfile,
  };
}

export const requireActiveRole = requireActiveRoleImpl;
