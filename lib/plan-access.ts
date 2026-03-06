import { createClient } from "@/lib/supabase/server";

export interface SessionAllowances {
  onfield?: Record<string, number>;
  virtual?: Record<string, number>;
  solo?: Record<string, number>;
}

export interface PlanAccess {
  hasPlan: boolean;
  soloAccess: boolean;
  virtualAccess: boolean;
  sessionAllowances: SessionAllowances | null;
  planName: string | null;
  billingStartDate?: string | null;
  sessionUsage?: { solo: Record<string, number>; virtual: Record<string, number> } | null;
}

/** Fetch active plan for a player. Returns planAccess. */
export async function getPlanAccessForPlayer(effectivePlayerId: string): Promise<PlanAccess> {
  const supabase = await createClient();
  const { data: sub } = await (supabase as any)
    .from("plan_subscriptions")
    .select("*")
    .eq("player_id", effectivePlayerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("[getPlanAccessForPlayer] effectivePlayerId:", effectivePlayerId, "sub:", sub ? "found" : "none");

  if (!sub) {
    return {
      hasPlan: false,
      soloAccess: false,
      virtualAccess: false,
      sessionAllowances: null,
      planName: null,
      billingStartDate: null,
      sessionUsage: null,
    };
  }

  const { data: plan } = await (supabase as any)
    .from("plans")
    .select("solo_access, virtual_access, session_allowances, name, plan_type")
    .eq("id", sub.plan_id)
    .single();

  console.log("[getPlanAccessForPlayer] plan:", JSON.stringify(plan));

  return {
    hasPlan: !!sub,
    soloAccess: plan?.solo_access ?? false,
    virtualAccess: plan?.virtual_access ?? false,
    sessionAllowances: plan?.session_allowances ?? null,
    planName: plan?.name ?? null,
    billingStartDate: sub.billing_start_date ?? sub.start_date ?? null,
    sessionUsage: null,
  };
}

/** Fetch plan access for parent: uses first linked player's active plan. */
export async function getPlanAccessForParent(parentId: string): Promise<PlanAccess> {
  const supabase = await createClient();
  const { data: rels } = await (supabase as any)
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", parentId);

  const playerIds = (rels || []).map((r: { player_id: string }) => r.player_id);
  if (playerIds.length === 0) {
    return {
      hasPlan: false,
      soloAccess: false,
      virtualAccess: false,
      sessionAllowances: null,
      planName: null,
    };
  }

  const { getActiveProfileIdFromCookies } = await import("@/lib/active-profile");
  const activeId = await getActiveProfileIdFromCookies();
  const effectivePlayerId = activeId && playerIds.includes(activeId) ? activeId : playerIds[0];
  console.log("[getPlanAccessForParent] parentId:", parentId, "effectivePlayerId:", effectivePlayerId, "linkedPlayerIds:", playerIds);
  return getPlanAccessForPlayer(effectivePlayerId);
}
