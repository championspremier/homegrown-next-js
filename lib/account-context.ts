/**
 * Client-side helper to resolve the effective player identity.
 *
 * Server components already resolve the correct player via the
 * `hg_active_profile` cookie + `requireActiveRole()`, so prefer
 * passing `playerId` as a prop whenever possible. Use this helper
 * only when a client component needs to independently determine
 * the account context (e.g. storage uploads that need auth.uid()).
 */

import { createClient } from "@/lib/supabase/client";

export interface AccountContext {
  authUserId: string;
  effectivePlayerId: string;
  isParentViewingAsPlayer: boolean;
  parentId: string | null;
}

export async function getAccountContext(): Promise<AccountContext | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const authUserId = user.id;

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .single();

  if (!profile) return null;

  if (profile.role === "parent") {
    const selectedPlayerId =
      typeof window !== "undefined"
        ? localStorage.getItem("selectedPlayerId")
        : null;

    if (selectedPlayerId) {
      const { data: relationship } = await (supabase as any)
        .from("parent_player_relationships")
        .select("player_id")
        .eq("parent_id", authUserId)
        .eq("player_id", selectedPlayerId)
        .single();

      if (relationship) {
        return {
          authUserId,
          effectivePlayerId: selectedPlayerId,
          isParentViewingAsPlayer: true,
          parentId: authUserId,
        };
      }
    }

    return {
      authUserId,
      effectivePlayerId: authUserId,
      isParentViewingAsPlayer: false,
      parentId: authUserId,
    };
  }

  return {
    authUserId,
    effectivePlayerId: authUserId,
    isParentViewingAsPlayer: false,
    parentId: null,
  };
}
