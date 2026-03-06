import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { UsersClient } from "./users-client";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { profile: adminProfile } = await requireRole("admin");
  const supabase = await createClient();

  const { data: profiles } = await (supabase as any)
    .from("profiles")
    .select(
      "id, email, full_name, first_name, last_name, role, birth_date, gender, phone_number, address_1, address_2, postal_code, created_at, updated_at, is_member, profile_photo_url"
    )
    .order("full_name", { nullsFirst: false });

  const { data: memberships } = await (supabase as any)
    .from("program_memberships")
    .select("id, profile_id, program_id, program_role, is_active, programs(id, name, logo_url)")
    .order("created_at");

  const { data: programs } = await (supabase as any)
    .from("programs")
    .select("id, name, logo_url")
    .eq("is_active", true)
    .order("name");

  /* Admin's program(s) for requires_approval (Offer Spot flow) */
  const { data: adminMemberships } = await (supabase as any)
    .from("program_memberships")
    .select("program_id, programs(id, requires_approval)")
    .eq("profile_id", adminProfile.id)
    .eq("is_active", true);
  const requiresApproval = (adminMemberships ?? []).some(
    (m: { programs?: { requires_approval?: boolean } }) => m.programs?.requires_approval === true
  );
  const adminOfferProgramId = (adminMemberships ?? []).find(
    (m: { programs?: { requires_approval?: boolean } }) => m.programs?.requires_approval === true
  )?.programs?.id ?? null;

  /* Platform owner check for Programs tab */
  const { data: adminProgramRows } = await (supabase as any)
    .from("program_memberships")
    .select("programs(is_platform_owner)")
    .eq("profile_id", adminProfile.id)
    .eq("is_active", true);
  const isPlatformOwner = (adminProgramRows ?? []).some(
    (r: { programs?: { is_platform_owner?: boolean } }) => r.programs?.is_platform_owner === true
  );

  let platformPrograms: { id: string; name: string; logo_url: string | null; plan_tier: string | null; contact_email: string | null; is_active: boolean; requires_approval: boolean; activeMembers: number }[] = [];
  if (isPlatformOwner) {
    const { data: allPrograms } = await (supabase as any)
      .from("programs")
      .select("id, name, logo_url, plan_tier, contact_email, is_active, requires_approval, is_platform_owner")
      .order("name");
    const { data: plansForCount } = await (supabase as any)
      .from("plans")
      .select("id, program_type");
    const { data: activeSubs } = await (supabase as any)
      .from("plan_subscriptions")
      .select("plan_id")
      .eq("status", "active");
    const planIdsByProgramType: Record<string, string[]> = {};
    for (const plan of plansForCount ?? []) {
      const key = plan.program_type ?? "__null__";
      if (!planIdsByProgramType[key]) planIdsByProgramType[key] = [];
      planIdsByProgramType[key].push(plan.id);
    }
    const subCountByPlanId: Record<string, number> = {};
    for (const sub of activeSubs ?? []) {
      subCountByPlanId[sub.plan_id] = (subCountByPlanId[sub.plan_id] || 0) + 1;
    }
    const memberCounts: Record<string, number> = {};
    for (const p of allPrograms ?? []) {
      const planIds = p.is_platform_owner
        ? (planIdsByProgramType["__null__"] ?? [])
        : (planIdsByProgramType[p.name] ?? []);
      memberCounts[p.id] = planIds.reduce((sum: number, pid: string) => sum + (subCountByPlanId[pid] || 0), 0);
    }
    platformPrograms = (allPrograms ?? []).map((p: { id: string; name: string; logo_url: string | null; plan_tier: string | null; contact_email: string | null; is_active: boolean; requires_approval: boolean; is_platform_owner?: boolean }) => {
      const { is_platform_owner: _ipo, ...rest } = p;
      return { ...rest, activeMembers: memberCounts[p.id] || 0 };
    });
  }

  const { data: relationships } = await (supabase as any)
    .from("parent_player_relationships")
    .select("parent_id, player_id");

  const { data: planSubscriptions } = await (supabase as any)
    .from("plan_subscriptions")
    .select("id, player_id, plan_id, status, start_date, end_date, created_at, updated_at, plans(id, name, category_id, program_type)")
    .order("created_at", { ascending: false });

  const { data: allPlans } = await (supabase as any)
    .from("plans")
    .select("id, name, plan_type, price, category_id, program_type, plan_categories(id, name)")
    .or("plan_recipient.eq.player,plan_recipient.is.null")
    .order("name");

  /* Pending program offers (for "Offer Sent" badge in Leads tab) */
  const todayStr = new Date().toISOString().split("T")[0];
  let pendingOfferPlayerIds: string[] = [];
  try {
    const { data: offers } = await (supabase as any)
      .from("program_offers")
      .select("player_id")
      .eq("status", "pending")
      .gte("expires_at", todayStr);
    pendingOfferPlayerIds = [...new Set((offers ?? []).map((o: { player_id: string }) => o.player_id))];
  } catch {
    /* program_offers table may not exist yet */
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Users</h1>
      <UsersClient
        profiles={profiles ?? []}
        memberships={memberships ?? []}
        programs={programs ?? []}
        relationships={relationships ?? []}
        planSubscriptions={planSubscriptions ?? []}
        allPlans={allPlans ?? []}
        adminId={adminProfile.id}
        requiresApproval={requiresApproval}
        adminOfferProgramId={adminOfferProgramId}
        pendingOfferPlayerIds={pendingOfferPlayerIds}
        isPlatformOwner={isPlatformOwner}
        platformPrograms={platformPrograms}
      />
    </div>
  );
}
