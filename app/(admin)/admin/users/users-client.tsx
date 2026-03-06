"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateUserRole } from "@/app/actions/admin";
import {
  UserPen,
  X,
  Plus,
  Search,
  UserPlus,
  Copy,
  Check,
  Save,
  Trash2,
  UserCheck,
  UserMinus,
  ChevronDown,
  ChevronRight,
  Bell,
  RotateCcw,
  Star,
  FileText,
  Phone,
  Users,
  Mail,
  CreditCard,
  Award,
  MoreHorizontal,
} from "lucide-react";
import { OfferSpotModal } from "./OfferSpotModal";
import { logSystemCommunication, logCommunication } from "@/app/actions/communications";
import styles from "./users.module.css";

/* ─── Types ─── */

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  birth_date: string | null;
  gender: string | null;
  phone_number: string | null;
  address_1: string | null;
  address_2: string | null;
  postal_code: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_member: boolean | null;
  profile_photo_url: string | null;
}

interface Membership {
  id: string;
  profile_id: string;
  program_id: string;
  program_role: string;
  is_active: boolean;
  programs: { id: string; name: string; logo_url: string | null } | null;
}

interface ProgramOption {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Relationship {
  parent_id: string;
  player_id: string;
}

interface PlanSubscription {
  id: string;
  player_id: string;
  plan_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  plans: { id: string; name: string; category_id: string | null; program_type: string | null } | null;
}

interface PlanOption {
  id: string;
  name: string;
  plan_type: string;
  price: number;
  category_id: string | null;
  program_type: string | null;
  plan_categories: { id: string; name: string } | null;
}

interface Discount {
  id: string;
  name: string;
  amount: number;
  discount_type: "flat" | "percentage";
  duration_type: "forever" | "once" | "repeating";
  duration_months: number | null;
  program_type: string | null;
  is_active: boolean;
}

interface FamilyUnit {
  parent: Profile;
  children: Profile[];
  anyMember: boolean;
  allLeads: boolean;
}

interface PlatformProgram {
  id: string;
  name: string;
  logo_url: string | null;
  plan_tier: string | null;
  contact_email: string | null;
  is_active: boolean;
  requires_approval: boolean;
  activeMembers: number;
}

interface UsersClientProps {
  profiles: Profile[];
  memberships: Membership[];
  programs: ProgramOption[];
  relationships: Relationship[];
  planSubscriptions: PlanSubscription[];
  allPlans: PlanOption[];
  adminId: string;
  requiresApproval?: boolean;
  adminOfferProgramId?: string | null;
  pendingOfferPlayerIds?: string[];
  isPlatformOwner?: boolean;
  platformPrograms?: PlatformProgram[];
}

const ROLES = ["player", "parent", "coach", "admin"];

function getInitials(p: Profile): string {
  const f = (p.first_name || "").charAt(0);
  const l = (p.last_name || "").charAt(0);
  if (f || l) return `${f}${l}`.toUpperCase();
  return (p.full_name || p.email || "?").charAt(0).toUpperCase();
}

function renderAvatar(p: Profile, size = 34) {
  if (p.profile_photo_url) {
    return (
      <img
        src={p.profile_photo_url}
        alt=""
        className={styles.avatarImg}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size < 30 ? "0.65rem" : "0.75rem" }}>
      {getInitials(p)}
    </div>
  );
}

function getDisplayName(p: Profile): string {
  if (p.first_name || p.last_name) return `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return p.full_name || p.email || "—";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function roleBadgeAttr(role: string | null): string {
  switch (role) {
    case "admin": return "admin";
    case "coach": return "coach";
    case "player": return "player";
    case "parent": return "parent";
    default: return "player";
  }
}

export function UsersClient({
  profiles,
  memberships,
  programs,
  relationships,
  planSubscriptions,
  allPlans,
  adminId,
  requiresApproval = false,
  adminOfferProgramId = null,
  pendingOfferPlayerIds = [],
  isPlatformOwner = false,
  platformPrograms = [],
}: UsersClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"staff" | "members" | "leads" | "programs">("members");
  const [leadsFilter, setLeadsFilter] = useState<"all" | "ex" | "new">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  /* ─── Assign Plan Modal State ─── */
  const [assignPlanPlayer, setAssignPlanPlayer] = useState<Profile | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignTargetSubId, setAssignTargetSubId] = useState<string | null>(null);
  const [assignIsSecondPlan, setAssignIsSecondPlan] = useState(false);
  const [assignBillingStart, setAssignBillingStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [assignDiscountId, setAssignDiscountId] = useState("");
  const [assignComp, setAssignComp] = useState(false);
  const [assignSendWelcome, setAssignSendWelcome] = useState(true);
  const [assignProrate, setAssignProrate] = useState(false);
  const [assignActivateToday, setAssignActivateToday] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planToast, setPlanToast] = useState<string | null>(null);

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [planHistory, setPlanHistory] = useState<PlanSubscription[]>([]);
  const [planHistoryTotal, setPlanHistoryTotal] = useState(0);
  const [loadingPlanHistory, setLoadingPlanHistory] = useState(false);
  const [loadingPlanHistoryMore, setLoadingPlanHistoryMore] = useState(false);

  const [offerSpotPlayer, setOfferSpotPlayer] = useState<Profile | null>(null);
  const [programsMenuOpen, setProgramsMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("discounts")
        .select("id, name, amount, discount_type, duration_type, duration_months, program_type, is_active")
        .eq("is_active", true);
      setDiscounts(data || []);
    })();
  }, [supabase]);

  /* ─── Memos ─── */

  const subsByPlayer = useMemo(() => {
    const map: Record<string, PlanSubscription[]> = {};
    for (const s of planSubscriptions) {
      if (s.status === "active") {
        if (!map[s.player_id]) map[s.player_id] = [];
        map[s.player_id].push(s);
      }
    }
    return map;
  }, [planSubscriptions]);

  const subsByPlayerAll = useMemo(() => {
    const map: Record<string, PlanSubscription[]> = {};
    for (const s of planSubscriptions) {
      if (!map[s.player_id]) map[s.player_id] = [];
      map[s.player_id].push(s);
    }
    return map;
  }, [planSubscriptions]);

  const exMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.role !== "player") continue;
      const active = subsByPlayer[p.id] || [];
      const all = subsByPlayerAll[p.id] || [];
      const hasCancelledOrExpired = all.some((s) => s.status === "cancelled" || s.status === "expired");
      if (active.length === 0 && hasCancelledOrExpired) set.add(p.id);
    }
    return set;
  }, [profiles, subsByPlayer, subsByPlayerAll]);

  const newLeadIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.role !== "player") continue;
      const all = subsByPlayerAll[p.id] || [];
      if (all.length === 0) set.add(p.id);
    }
    return set;
  }, [profiles, subsByPlayerAll]);

  const lastCancelledPlanByPlayer = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profiles) {
      if (p.role !== "player") continue;
      const all = (subsByPlayerAll[p.id] || []).filter((s) => s.status === "cancelled" || s.status === "expired");
      const last = all.sort((a, b) => {
        const aDate = a.updated_at || a.created_at || "";
        const bDate = b.updated_at || b.created_at || "";
        return bDate.localeCompare(aDate);
      })[0];
      if (last) map[p.id] = last.plan_id;
    }
    return map;
  }, [profiles, subsByPlayerAll]);

  const plansByCategory = useMemo(() => {
    const catMap: Record<string, { name: string; plans: PlanOption[] }> = {};
    const uncategorized: PlanOption[] = [];
    for (const p of allPlans) {
      if (p.plan_categories) {
        const catId = p.plan_categories.id;
        if (!catMap[catId]) catMap[catId] = { name: p.plan_categories.name, plans: [] };
        catMap[catId].plans.push(p);
      } else {
        uncategorized.push(p);
      }
    }
    return { grouped: Object.values(catMap), uncategorized };
  }, [allPlans]);

  const homegrownPlans = useMemo(() => allPlans.filter((p) => p.program_type == null || p.program_type === ""), [allPlans]);
  const onFieldPlans = useMemo(() => allPlans.filter((p) => p.program_type != null && p.program_type !== ""), [allPlans]);

  function getPlansForSecondPlan(playerId: string): PlanOption[] {
    const activeSubs = subsByPlayer[playerId] || [];
    if (activeSubs.length !== 1) return allPlans;
    const hasOnField = activeSubs.some((s) => s.plans?.program_type != null && s.plans.program_type !== "");
    return hasOnField ? homegrownPlans : onFieldPlans;
  }

  function groupPlansByCategory(plans: PlanOption[]): { grouped: { name: string; plans: PlanOption[] }[]; uncategorized: PlanOption[] } {
    const catMap: Record<string, { name: string; plans: PlanOption[] }> = {};
    const uncategorized: PlanOption[] = [];
    for (const p of plans) {
      if (p.plan_categories) {
        const catId = p.plan_categories.id;
        if (!catMap[catId]) catMap[catId] = { name: p.plan_categories.name, plans: [] };
        catMap[catId].plans.push(p);
      } else {
        uncategorized.push(p);
      }
    }
    return { grouped: Object.values(catMap), uncategorized };
  }

  const membershipsByProfile = useMemo(() => {
    const map: Record<string, Membership[]> = {};
    for (const m of memberships) {
      if (!map[m.profile_id]) map[m.profile_id] = [];
      map[m.profile_id].push(m);
    }
    return map;
  }, [memberships]);

  const childrenByParent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const r of relationships) {
      if (!map[r.parent_id]) map[r.parent_id] = [];
      map[r.parent_id].push(r.player_id);
    }
    return map;
  }, [relationships]);

  const parentsByPlayer = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const r of relationships) {
      if (!map[r.player_id]) map[r.player_id] = [];
      map[r.player_id].push(r.parent_id);
    }
    return map;
  }, [relationships]);

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) map[p.id] = p;
    return map;
  }, [profiles]);

  const isMember = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.role !== "player") continue;
      const activeSubs = subsByPlayer[p.id] || [];
      if (activeSubs.length > 0 || p.is_member === true) set.add(p.id);
    }
    return set;
  }, [profiles, subsByPlayer]);

  const linkedPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of relationships) set.add(r.player_id);
    return set;
  }, [relationships]);

  const pendingOfferSet = useMemo(() => new Set(pendingOfferPlayerIds), [pendingOfferPlayerIds]);

  const adminOfferProgram = useMemo(
    () => (adminOfferProgramId ? programs.find((p) => p.id === adminOfferProgramId) : null),
    [adminOfferProgramId, programs]
  );

  /* ─── Family grouping logic ─── */
  const { familyUnits, standalonePlayers } = useMemo(() => {
    const parents = profiles.filter((p) => p.role === "parent");
    const families: FamilyUnit[] = [];
    const claimedPlayerIds = new Set<string>();

    for (const parent of parents) {
      const childIds = childrenByParent[parent.id] || [];
      const children = childIds.map((id) => profilesById[id]).filter((c): c is Profile => !!c && c.role === "player");
      if (children.length === 0) continue;

      for (const c of children) claimedPlayerIds.add(c.id);

      const anyMember = children.some((c) => isMember.has(c.id));
      const allLeads = children.every((c) => !isMember.has(c.id));

      families.push({ parent, children, anyMember, allLeads });
    }

    const standalone = profiles.filter(
      (p) => p.role === "player" && !claimedPlayerIds.has(p.id)
    );

    return { familyUnits: families, standalonePlayers: standalone };
  }, [profiles, childrenByParent, profilesById, isMember]);

  function viewMembersForProgram(programId: string) {
    setProgramFilter(programId);
    setActiveTab("members");
  }

  const programFilterName = programFilter === "all" ? null : (platformPrograms.find((p) => p.id === programFilter)?.name ?? programs.find((p) => p.id === programFilter)?.name ?? null);

  /* ─── Filtered rows for each tab ─── */
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    function matchesSearch(p: Profile) {
      if (!q) return true;
      return (
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.first_name || "").toLowerCase().includes(q) ||
        (p.last_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
      );
    }

    function matchesProgram(p: Profile) {
      if (programFilter === "all") return true;
      const profileIdsInProgram = new Set(memberships.filter((m) => m.program_id === programFilter).map((m) => m.profile_id));
      return profileIdsInProgram.has(p.id);
    }

    function familyMatchesSearch(f: FamilyUnit) {
      if (!q) return true;
      if (matchesSearch(f.parent)) return true;
      return f.children.some((c) => matchesSearch(c));
    }

    if (activeTab === "staff") {
      return {
        staff: profiles.filter((p) => (p.role === "coach" || p.role === "admin") && matchesSearch(p) && matchesProgram(p)),
        memberFamilies: [] as FamilyUnit[],
        memberStandalone: [] as Profile[],
        leadFamilies: [] as FamilyUnit[],
        leadStandalone: [] as Profile[],
      };
    }

    if (activeTab === "members") {
      const memberFamilies = familyUnits.filter((f) => f.anyMember && familyMatchesSearch(f));
      const memberStandalone = standalonePlayers.filter((p) => isMember.has(p.id) && matchesSearch(p) && matchesProgram(p));
      return { staff: [], memberFamilies, memberStandalone, leadFamilies: [] as FamilyUnit[], leadStandalone: [] as Profile[] };
    }

    let leadFamilies = familyUnits.filter((f) => f.allLeads && familyMatchesSearch(f));
    let leadStandalone = standalonePlayers.filter((p) => !isMember.has(p.id) && matchesSearch(p) && matchesProgram(p));

    if (leadsFilter === "ex") {
      const familyHasExMember = (f: FamilyUnit) => f.children.some((c) => exMemberIds.has(c.id));
      const familyHasNewLead = (f: FamilyUnit) => f.children.some((c) => newLeadIds.has(c.id));
      leadFamilies = leadFamilies.filter(familyHasExMember);
      leadStandalone = leadStandalone.filter((p) => exMemberIds.has(p.id));
    } else if (leadsFilter === "new") {
      const familyHasNewLead = (f: FamilyUnit) => f.children.some((c) => newLeadIds.has(c.id));
      leadFamilies = leadFamilies.filter(familyHasNewLead);
      leadStandalone = leadStandalone.filter((p) => newLeadIds.has(p.id));
    }

    return { staff: [], memberFamilies: [] as FamilyUnit[], memberStandalone: [] as Profile[], leadFamilies, leadStandalone };
  }, [profiles, memberships, familyUnits, standalonePlayers, isMember, exMemberIds, newLeadIds, leadsFilter, activeTab, programFilter, searchQuery]);

  /* ─── Tab counts ─── */
  const tabCounts = useMemo(() => {
    const staff = profiles.filter((p) => p.role === "coach" || p.role === "admin").length;
    const memberFamilyCount = familyUnits.filter((f) => f.anyMember).length;
    const memberStandaloneCount = standalonePlayers.filter((p) => isMember.has(p.id)).length;
    const leadFamilyCount = familyUnits.filter((f) => f.allLeads).length;
    const leadStandaloneCount = standalonePlayers.filter((p) => !isMember.has(p.id)).length;
    return {
      staff,
      members: memberFamilyCount + memberStandaloneCount,
      leads: leadFamilyCount + leadStandaloneCount,
      programs: platformPrograms.length,
    };
  }, [profiles, familyUnits, standalonePlayers, isMember, platformPrograms]);

  /* ─── Actions ─── */

  function toggleFamily(parentId: string) {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }

  async function openAssignPlan(player: Profile, options?: { reengagePlanId?: string; targetSubId?: string; isSecondPlan?: boolean }) {
    const activeSubs = subsByPlayer[player.id] || [];
    setAssignPlanPlayer(player);
    setAssignTargetSubId(options?.targetSubId || null);
    setAssignIsSecondPlan(options?.isSecondPlan || false);

    if (options?.reengagePlanId) {
      setAssignPlanId(options.reengagePlanId);
    } else if (options?.targetSubId) {
      const sub = activeSubs.find((s) => s.id === options!.targetSubId);
      setAssignPlanId(sub?.plan_id || "");
    } else if (options?.isSecondPlan) {
      setAssignPlanId("");
    } else if (activeSubs.length > 0) {
      setAssignPlanId(activeSubs[0].plan_id);
    } else {
      setAssignPlanId("");
    }

    setAssignBillingStart(new Date().toISOString().split("T")[0]);
    setAssignDiscountId("");
    setAssignComp(false);
    setAssignSendWelcome(true);
    setAssignProrate(false);
    setAssignActivateToday(true);

    setLoadingPlanHistory(true);
    const { data, count } = await (supabase as any)
      .from("plan_subscriptions")
      .select("id, player_id, plan_id, status, start_date, end_date, created_at, updated_at, plans(id, name, category_id, program_type)", { count: "exact" })
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .range(0, 2);
    setPlanHistory(data || []);
    setPlanHistoryTotal(count ?? 0);
    setLoadingPlanHistory(false);
  }

  async function loadMoreAssignPlanHistory() {
    if (!assignPlanPlayer) return;
    setLoadingPlanHistoryMore(true);
    const from = planHistory.length;
    const { data } = await (supabase as any)
      .from("plan_subscriptions")
      .select("id, player_id, plan_id, status, start_date, end_date, created_at, updated_at, plans(id, name, category_id, program_type)")
      .eq("player_id", assignPlanPlayer.id)
      .order("created_at", { ascending: false })
      .range(from, from + 2);
    setPlanHistory((prev) => [...prev, ...(data || [])]);
    setLoadingPlanHistoryMore(false);
  }

  function openReengage(player: Profile) {
    const lastPlanId = lastCancelledPlanByPlayer[player.id];
    if (lastPlanId) openAssignPlan(player, { reengagePlanId: lastPlanId });
    else openAssignPlan(player);
  }

  async function handleAssignPlan() {
    if (!assignPlanPlayer || !assignPlanId) return;
    setSavingPlan(true);
    const activeSubs = subsByPlayer[assignPlanPlayer.id] || [];

    if (!assignIsSecondPlan) {
      if (assignTargetSubId) {
        await (supabase as any)
          .from("plan_subscriptions")
          .update({ status: "expired" })
          .eq("id", assignTargetSubId);
      } else if (activeSubs.length > 0) {
        for (const s of activeSubs) {
          await (supabase as any)
            .from("plan_subscriptions")
            .update({ status: "expired" })
            .eq("id", s.id);
        }
      }
    }

    const billingDate = assignBillingStart || new Date().toISOString().split("T")[0];

    await (supabase as any).from("plan_subscriptions").insert({
      plan_id: assignPlanId,
      player_id: assignPlanPlayer.id,
      status: "active",
      start_date: billingDate,
      billing_start_date: billingDate,
      discount_id: assignDiscountId || null,
      is_comp: assignComp,
      activate_immediately: assignActivateToday,
      created_by: adminId,
    });

    const selectedPlanForAssign = allPlans.find((p) => p.id === assignPlanId);
    const planNameForAssign = selectedPlanForAssign?.name || "Plan";

    if (assignSendWelcome) {
      const planNameStr = planNameForAssign || "your plan";
      const notif = {
        notification_type: "information",
        title: `Welcome to ${planNameStr}!`,
        message: `You have been enrolled in ${planNameStr}. Your plan starts ${billingDate}.`,
        is_read: false,
      };

      await (supabase as any).from("notifications").insert({
        ...notif,
        recipient_id: assignPlanPlayer.id,
        recipient_role: "player",
      });

      const playerParents = parentsByPlayer[assignPlanPlayer.id] || [];
      if (playerParents.length > 0) {
        const parentNotifs = playerParents.map((pid) => ({
          ...notif,
          recipient_id: pid,
          recipient_role: "parent",
        }));
        await (supabase as any).from("notifications").insert(parentNotifs);
      }
    }

    await logSystemCommunication({
      playerId: assignPlanPlayer.id,
      authorId: adminId,
      type: "plan_change",
      note: `Plan assigned: ${planNameForAssign}`,
    });

    setSavingPlan(false);
    setAssignPlanPlayer(null);
    setPlanToast("Plan assigned");
    setTimeout(() => setPlanToast(null), 3000);
    router.refresh();
  }

  async function handleCancelPlayerPlan(subId?: string) {
    if (!assignPlanPlayer) return;
    const activeSubs = subsByPlayer[assignPlanPlayer.id] || [];
    const toCancel = subId ? activeSubs.find((s) => s.id === subId) : activeSubs[0];
    if (!toCancel) return;
    if (!window.confirm(`Cancel ${getDisplayName(assignPlanPlayer)}'s plan?`)) return;
    setSavingPlan(true);

    const playerName = getDisplayName(assignPlanPlayer);
    const planName = toCancel.plans?.name || "Plan";

    await (supabase as any)
      .from("plan_subscriptions")
      .update({ status: "cancelled", rating_requested: true })
      .eq("id", toCancel.id);

    const planProgramType = toCancel.plans?.program_type ?? null;
    console.log("[handleCancelPlayerPlan] plan program_type:", planProgramType, "(null/empty = Homegrown, string = on-field)");

    let coaches: { id: string }[] = [];

    if (planProgramType == null || planProgramType === "") {
      const { data } = await (supabase as any).from("profiles").select("id").eq("role", "coach");
      coaches = data || [];
      console.log("[handleCancelPlayerPlan] Homegrown plan: fetched", coaches.length, "coaches (all)");
    } else {
      const slug = String(planProgramType).toLowerCase().replace(/\s+/g, "-");
      const { data: byName } = await (supabase as any).from("programs").select("id").eq("name", planProgramType);
      const { data: bySlug } = await (supabase as any).from("programs").select("id").eq("slug", slug);
      const programIds = [...new Set([...(byName || []), ...(bySlug || [])].map((p: { id: string }) => p.id))];
      if (programIds.length > 0) {
        const { data: memberships } = await (supabase as any)
          .from("program_memberships")
          .select("profile_id")
          .in("program_id", programIds)
          .eq("is_active", true);
        const profileIds = [...new Set((memberships || []).map((m: { profile_id: string }) => m.profile_id))];
        if (profileIds.length > 0) {
          const { data: coachProfiles } = await (supabase as any)
            .from("profiles")
            .select("id")
            .in("id", profileIds)
            .eq("role", "coach");
          coaches = coachProfiles || [];
        }
      }
      console.log("[handleCancelPlayerPlan] On-field plan:", planProgramType, "| programs:", programIds.length, "| coaches:", coaches.length);
    }

    const ratingPayload = {
      notification_type: "rating_request" as const,
      title: "Rate a Player",
      message: `${playerName} completed their ${planName} plan. Please rate their development.`,
      is_read: false,
      data: {
        subscription_id: toCancel.id,
        player_id: assignPlanPlayer.id,
        player_name: playerName,
        plan_name: planName,
      },
    };

    if (coaches.length > 0) {
      const coachNotifs = coaches.map((c: { id: string }) => ({
        recipient_id: c.id,
        recipient_role: "coach",
        ...ratingPayload,
      }));
      console.log("[handleCancelPlayerPlan] Inserting", coachNotifs.length, "coach notifications");
      const { error: coachErr } = await (supabase as any).from("notifications").insert(coachNotifs);
      if (coachErr) console.error("[handleCancelPlayerPlan] Coach notification insert error:", coachErr);
    } else {
      console.log("[handleCancelPlayerPlan] No coaches found — skipping coach notifications");
    }

    const { data: admins } = await (supabase as any).from("profiles").select("id").eq("role", "admin");
    const adminList = admins || [];
    if (adminList.length > 0) {
      const adminNotifs = adminList.map((a: { id: string }) => ({
        recipient_id: a.id,
        recipient_role: "admin",
        ...ratingPayload,
      }));
      console.log("[handleCancelPlayerPlan] Inserting", adminNotifs.length, "admin notifications");
      const { error: adminErr } = await (supabase as any).from("notifications").insert(adminNotifs);
      if (adminErr) console.error("[handleCancelPlayerPlan] Admin notification insert error:", adminErr);
    }

    await logSystemCommunication({
      playerId: assignPlanPlayer.id,
      authorId: adminId,
      type: "plan_change",
      note: `Plan cancelled: ${planName}`,
    });

    const playerNotif = {
      recipient_id: assignPlanPlayer.id,
      recipient_role: "player",
      notification_type: "information",
      title: "Your plan has ended",
      message: `Your ${planName} plan has been cancelled. Contact your coach or admin to renew or switch plans.`,
      is_read: false,
      data: { plan_id: toCancel.plan_id, plan_name: planName },
    };
    await (supabase as any).from("notifications").insert(playerNotif);

    const parentIds = parentsByPlayer[assignPlanPlayer.id] || [];
    const playerFirstName = assignPlanPlayer.first_name || (playerName || "").split(" ")[0] || "Your child";
    if (parentIds.length > 0) {
      const parentNotifs = parentIds.map((parentId: string) => ({
        recipient_id: parentId,
        recipient_role: "parent",
        notification_type: "information",
        title: `${playerFirstName}'s plan has ended`,
        message: `${playerName}'s ${planName} plan has been cancelled. Please contact your coach or admin to renew.`,
        is_read: false,
        data: { plan_id: toCancel.plan_id, plan_name: planName, player_id: assignPlanPlayer.id },
      }));
      await (supabase as any).from("notifications").insert(parentNotifs);
    }

    setSavingPlan(false);
    setAssignPlanPlayer(null);
    setPlanToast("Plan cancelled. Coaches, admins, player and parent notified.");
    setTimeout(() => setPlanToast(null), 3000);
    router.refresh();
  }

  async function handleMarkAsMember(player: Profile) {
    await (supabase as any).from("profiles").update({ is_member: true }).eq("id", player.id);
    setPlanToast(`${getDisplayName(player)} moved to Members`);
    setTimeout(() => setPlanToast(null), 3000);
    router.refresh();
  }

  async function handleMoveToLeads(player: Profile) {
    const activeSubs = subsByPlayer[player.id] || [];
    if (activeSubs.length > 0) {
      setPlanToast("Remove their plan first before moving to Leads");
      setTimeout(() => setPlanToast(null), 3000);
      return;
    }
    await (supabase as any).from("profiles").update({ is_member: false }).eq("id", player.id);
    setPlanToast(`${getDisplayName(player)} moved to Leads`);
    setTimeout(() => setPlanToast(null), 3000);
    router.refresh();
  }

  function getProgramPills(profileId: string) {
    const ms = membershipsByProfile[profileId] || [];
    return ms.filter((m) => m.is_active && m.programs).map((m) => m.programs!);
  }

  function handleCopyLink(slug: string, programName: string) {
    const link = `yourdomain.com/join/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(programName);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  /* ─── Discount price preview ─── */
  const selectedPlan = allPlans.find((p) => p.id === assignPlanId);
  const selectedDiscount = discounts.find((d) => d.id === assignDiscountId);
  const isRecurring = selectedPlan?.plan_type === "recurring";
  const today = new Date().toISOString().split("T")[0];
  const isFutureBilling = assignBillingStart > today;

  function getPricePreview(): string | null {
    if (!selectedPlan) return null;
    const price = selectedPlan.price;
    if (assignComp) {
      return isRecurring ? "Monthly: $0" : "Total: $0";
    }
    if (!selectedDiscount) return null;
    let final: number;
    if (selectedDiscount.discount_type === "percentage") {
      final = price * (1 - selectedDiscount.amount / 100);
    } else {
      final = Math.max(0, price - selectedDiscount.amount);
    }
    const label = isRecurring ? "Monthly" : "Total";
    return `${label}: $${price.toFixed(2)} → $${final.toFixed(2)}`;
  }

  function getProratePreview(): string | null {
    if (!selectedPlan || !isRecurring || !assignProrate || assignComp) return null;
    const price = selectedPlan.price;
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyRate = price / 30;
    const prorated = dailyRate * daysRemaining;
    return `Prorated amount: $${prorated.toFixed(2)} (~$${dailyRate.toFixed(2)}/day for ${daysRemaining} days)`;
  }

  /* ─── Render helpers ─── */

  function renderProgramLogos(profileId: string) {
    const pills = getProgramPills(profileId);
    if (pills.length === 0) return <span className={styles.noPlan}>—</span>;
    return (
      <>
        {pills.map((pg) => (
          pg.logo_url ? (
            <img key={pg.id} src={pg.logo_url} alt={pg.name} title={pg.name} className={styles.programLogoCircle} />
          ) : (
            <div key={pg.id} className={styles.programLogoFallback} title={pg.name}>
              {pg.name.charAt(0).toUpperCase()}
            </div>
          )
        ))}
      </>
    );
  }

  function getAddSecondPlanLabel(playerId: string): string {
    const activeSubs = subsByPlayer[playerId] || [];
    if (activeSubs.length !== 1) return "+ Add";
    const hasOnField = activeSubs.some((s) => s.plans?.program_type != null && s.plans.program_type !== "");
    const hasHomegrown = activeSubs.some((s) => s.plans?.program_type == null || s.plans.program_type === "");
    if (hasOnField) return "+ Add Homegrown Virtual Plan";
    if (hasHomegrown) return "+ Add On-Field Plan";
    return "+ Add";
  }

  function renderPlanCell(player: Profile) {
    const activeSubs = subsByPlayer[player.id] || [];
    if (activeSubs.length === 0) {
      return (
        <button type="button" className={styles.noPlanBtn} onClick={() => openAssignPlan(player)}>
          No plan
        </button>
      );
    }
    return (
      <div className={styles.planBadgesWrap}>
        {activeSubs.map((sub, idx) => (
          <button
            key={sub.id}
            type="button"
            className={idx === 0 ? styles.planBadge : styles.planBadgeSecond}
            onClick={() => openAssignPlan(player, { targetSubId: sub.id })}
          >
            {sub.plans?.name || "Plan"}
          </button>
        ))}
        {activeSubs.length === 1 && (
          <button
            type="button"
            className={styles.addSecondPlanBtn}
            onClick={(e) => { e.stopPropagation(); openAssignPlan(player, { isSecondPlan: true }); }}
          >
            {getAddSecondPlanLabel(player.id)}
          </button>
        )}
      </div>
    );
  }

  /* ─── Family row renderer ─── */
  function renderFamilyRow(family: FamilyUnit, tabType: "members" | "leads") {
    const isExpanded = expandedFamilies.has(family.parent.id);
    const firstChildWithPlan = family.children.find((c) => (subsByPlayer[c.id] || []).length > 0);
    const firstSubs = firstChildWithPlan ? (subsByPlayer[firstChildWithPlan.id] || []) : [];
    const planLabel = firstSubs.length > 0 ? firstSubs.map((s) => s.plans?.name || "Plan").join(", ") : "No plan";
    const someWithPlan = family.children.some((c) => (subsByPlayer[c.id] || []).length > 0);
    const someWithout = family.children.some((c) => (subsByPlayer[c.id] || []).length === 0);
    const showSiblingBanner = someWithPlan && someWithout;

    return (
      <Fragment key={family.parent.id}>
        <tr
          className={`${styles.familyRow} ${isExpanded ? styles.familyRowExpanded : ""}`}
          onClick={() => toggleFamily(family.parent.id)}
        >
          <td>
            <div className={styles.nameCell}>
              {renderAvatar(family.parent)}
              <div className={styles.nameInfo}>
                <span className={styles.nameText}>{getDisplayName(family.parent)}</span>
                <span className={styles.emailText}>
                  {family.children.length} player{family.children.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </td>
          <td>
            <div className={styles.programPills}>
              {renderProgramLogos(family.children[0]?.id || family.parent.id)}
            </div>
          </td>
          <td>
            {firstChildWithPlan ? (
              <span className={styles.planBadgeStatic}>{planLabel}</span>
            ) : (
              <span className={styles.noPlan}>No plan</span>
            )}
          </td>
          <td>
            {tabType === "members" ? (
              <span className={styles.statusBadge} data-status="active">Active</span>
            ) : (
              <span className={styles.statusBadge} data-status="inactive">Lead</span>
            )}
          </td>
          <td className={styles.dateCell}>{formatDate(family.parent.created_at)}</td>
          <td>
            <div className={styles.rowActions}>
              {tabType === "leads" && (
                <button
                  className={styles.editBtn}
                  onClick={(e) => { e.stopPropagation(); family.children.forEach(handleMarkAsMember); }}
                  type="button"
                  title="Mark as Member"
                >
                  <UserCheck size={15} />
                </button>
              )}
              <button
                className={styles.editBtn}
                onClick={(e) => { e.stopPropagation(); setEditingUser(family.parent); }}
                type="button"
                title="Edit"
              >
                <UserPen size={15} />
              </button>
              <button
                className={styles.expandChevron}
                onClick={(e) => { e.stopPropagation(); toggleFamily(family.parent.id); }}
                type="button"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr className={styles.familySubContainer}>
            <td colSpan={6} style={{ padding: 0 }}>
              <div className={styles.familySubRows}>
                {showSiblingBanner && (
                  <div className={styles.siblingBanner}>
                    <span>💛 One player has no plan — consider offering a sibling discount</span>
                  </div>
                )}
                {family.children.map((child) => (
                  <div key={child.id} className={styles.familyChildRow}>
                    <div className={styles.childConnector} />
                    <div className={styles.childContent}>
                      <div className={styles.nameCell}>
                        {renderAvatar(child, 28)}
                        <div className={styles.nameInfo}>
                          <span className={styles.nameText}>
                            {getDisplayName(child)}
                            {tabType === "leads" && exMemberIds.has(child.id) && (
                              <span className={styles.exMemberBadge}>Ex-Member</span>
                            )}
                            {tabType === "leads" && pendingOfferSet.has(child.id) && (
                              <span className={styles.offerSentBadge}>Offer Sent</span>
                            )}
                          </span>
                          <span className={styles.emailText}>{child.email || "—"}</span>
                        </div>
                      </div>
                      <div className={styles.childPlan}>
                        {renderPlanCell(child)}
                      </div>
                      <div className={styles.childStatus}>
                        {(subsByPlayer[child.id] || []).length > 0 ? (
                          <span className={styles.statusBadge} data-status="active">Active</span>
                        ) : (
                          <span className={styles.leadBadge}>Lead</span>
                        )}
                      </div>
                      <div className={styles.rowActions}>
                        {tabType === "members" && (
                          <button className={styles.editBtn} onClick={() => handleMoveToLeads(child)} type="button" title="Move to Leads"><UserMinus size={14} /></button>
                        )}
                        {tabType === "leads" && (
                          <>
                            {requiresApproval && (
                              <button className={styles.editBtn} onClick={() => setOfferSpotPlayer(child)} type="button" title="Offer Spot"><Star size={14} /></button>
                            )}
                            {exMemberIds.has(child.id) && (
                              <button className={styles.editBtn} onClick={() => openReengage(child)} type="button" title="Re-engage"><RotateCcw size={14} /></button>
                            )}
                            <button className={styles.editBtn} onClick={() => handleMarkAsMember(child)} type="button" title="Mark as Member"><UserCheck size={14} /></button>
                          </>
                        )}
                        <button className={styles.editBtn} onClick={() => setEditingUser(child)} type="button" title="Edit"><UserPen size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  /* ─── Standalone player row ─── */
  function renderStandaloneRow(p: Profile, tabType: "members" | "leads") {
    return (
      <tr key={p.id}>
        <td>
          <div className={styles.nameCell}>
            {renderAvatar(p)}
            <div className={styles.nameInfo}>
              <span className={styles.nameText}>
                {getDisplayName(p)}
                {tabType === "leads" && exMemberIds.has(p.id) && (
                  <span className={styles.exMemberBadge}>Ex-Member</span>
                )}
                {tabType === "leads" && pendingOfferSet.has(p.id) && (
                  <span className={styles.offerSentBadge}>Offer Sent</span>
                )}
              </span>
              <span className={styles.emailText}>{p.email || "—"}</span>
            </div>
          </div>
        </td>
        <td>
          <div className={styles.programPills}>
            {renderProgramLogos(p.id)}
          </div>
        </td>
        <td>{renderPlanCell(p)}</td>
        <td>
          {tabType === "members" ? (
            <span className={styles.statusBadge} data-status="active">Active</span>
          ) : (
            <span className={styles.statusBadge} data-status="inactive">Lead</span>
          )}
        </td>
        <td className={styles.dateCell}>{formatDate(tabType === "members" ? p.updated_at : p.created_at)}</td>
        <td>
          <div className={styles.rowActions}>
            {tabType === "members" && (
              <button className={styles.editBtn} onClick={() => handleMoveToLeads(p)} type="button" title="Move to Leads"><UserMinus size={15} /></button>
            )}
            {tabType === "leads" && (
              <>
                {requiresApproval && (
                  <button className={styles.editBtn} onClick={() => setOfferSpotPlayer(p)} type="button" title="Offer Spot"><Star size={15} /></button>
                )}
                {exMemberIds.has(p.id) && (
                  <button className={styles.editBtn} onClick={() => openReengage(p)} type="button" title="Re-engage"><RotateCcw size={15} /></button>
                )}
                <button className={styles.editBtn} onClick={() => handleMarkAsMember(p)} type="button" title="Mark as Member"><UserCheck size={15} /></button>
              </>
            )}
            <button className={styles.editBtn} onClick={() => setEditingUser(p)} type="button" title="Edit"><UserPen size={15} /></button>
          </div>
        </td>
      </tr>
    );
  }

  const totalRows =
    activeTab === "staff" ? filteredData.staff.length :
    activeTab === "members" ? filteredData.memberFamilies.length + filteredData.memberStandalone.length :
    activeTab === "leads" ? filteredData.leadFamilies.length + filteredData.leadStandalone.length :
    activeTab === "programs" ? platformPrograms.length : 0;

  const pricePreview = getPricePreview();

  return (
    <div className={styles.container}>
      {/* Tabs bar */}
      <div className={styles.tabsBar}>
        <div className={styles.tabs}>
          {([
            ["members", "Members", tabCounts.members],
            ["leads", "Leads", tabCounts.leads],
            ["staff", "Staff", tabCounts.staff],
            ...(isPlatformOwner ? [["programs", "Programs", tabCounts.programs] as const] : []),
          ] as const).map(([key, label, count]) => (
            <button key={key} className={`${styles.tab} ${activeTab === key ? styles.tabActive : ""}`} onClick={() => setActiveTab(key)} type="button">
              {label} <span className={styles.tabCount}>{count}</span>
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          {programs.length > 0 && (
            <select className={styles.programFilter} value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              <option value="all">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input className={styles.searchInput} placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className={styles.addBtnGradient} onClick={() => setAddPersonOpen(true)} type="button">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Program filter banner (when viewing members from a specific program) */}
      {activeTab === "members" && programFilter !== "all" && programFilterName && (
        <div className={styles.filterBanner}>
          <span>Showing members from {programFilterName}</span>
          <button type="button" className={styles.filterBannerClear} onClick={() => setProgramFilter("all")}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Leads filter row (only when Leads tab active) */}
      {activeTab === "leads" && (
        <div className={styles.leadsFilterRow}>
          {(["all", "ex", "new"] as const).map((key) => (
            <button
              key={key}
              className={`${styles.leadsFilterPill} ${leadsFilter === key ? styles.leadsFilterPillActive : ""}`}
              onClick={() => setLeadsFilter(key)}
              type="button"
            >
              {key === "all" ? "All Leads" : key === "ex" ? "Ex-Members" : "New Leads"}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className={`${styles.tableWrap} ${activeTab === "programs" ? styles.tableWrapPrograms : ""}`}>
        <table className={styles.table}>
          <thead>
            {activeTab === "staff" && (
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Programs</th>
                <th>Last Active</th>
                <th style={{ width: 50 }} />
              </tr>
            )}
            {(activeTab === "members" || activeTab === "leads") && (
              <tr>
                <th>Name</th>
                <th>Programs</th>
                <th>Plan</th>
                <th>Status</th>
                <th>{activeTab === "members" ? "Last Active" : "Signed Up"}</th>
                <th style={{ width: 80 }} />
              </tr>
            )}
            {activeTab === "programs" && (
              <tr>
                <th>Program</th>
                <th>Plan Tier</th>
                <th>Active Members</th>
                <th>Contact Email</th>
                <th style={{ width: 50 }} />
              </tr>
            )}
          </thead>
          <tbody>
            {totalRows === 0 && activeTab !== "programs" && (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>No users found.</td>
              </tr>
            )}
            {activeTab === "programs" && platformPrograms.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>No programs found.</td>
              </tr>
            )}

            {/* Staff tab */}
            {activeTab === "staff" && filteredData.staff.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className={styles.nameCell}>
                    {renderAvatar(p)}
                    <div className={styles.nameInfo}>
                      <span className={styles.nameText}>{getDisplayName(p)}</span>
                      <span className={styles.emailText}>{p.email || "—"}</span>
                    </div>
                  </div>
                </td>
                <td><span className={styles.roleBadge} data-role={roleBadgeAttr(p.role)}>{p.role}</span></td>
                <td>
                  <div className={styles.programPills}>
                    {renderProgramLogos(p.id)}
                  </div>
                </td>
                <td className={styles.dateCell}>{formatDate(p.updated_at)}</td>
                <td><button className={styles.editBtn} onClick={() => setEditingUser(p)} type="button"><UserPen size={16} /></button></td>
              </tr>
            ))}

            {/* Members tab */}
            {activeTab === "members" && (
              <>
                {filteredData.memberFamilies.map((f) => renderFamilyRow(f, "members"))}
                {filteredData.memberStandalone.map((p) => renderStandaloneRow(p, "members"))}
              </>
            )}

            {/* Leads tab */}
            {activeTab === "leads" && (
              <>
                {filteredData.leadFamilies.map((f) => renderFamilyRow(f, "leads"))}
                {filteredData.leadStandalone.map((p) => renderStandaloneRow(p, "leads"))}
              </>
            )}

            {/* Programs tab */}
            {activeTab === "programs" && platformPrograms.map((prog) => (
              <tr key={prog.id}>
                <td>
                  <div className={styles.nameCell}>
                    {prog.logo_url ? (
                      <img src={prog.logo_url} alt="" className={styles.programLogoCircle} style={{ width: 32, height: 32 }} />
                    ) : (
                      <div className={styles.programLogoFallback} style={{ width: 32, height: 32, fontSize: "0.75rem" }}>
                        {prog.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.nameInfo}>
                      <span className={styles.nameText}>{prog.name}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`${styles.planTierBadge} ${(prog.plan_tier || "free").toLowerCase() === "pro" ? styles.planTierpro : (prog.plan_tier || "free").toLowerCase() === "enterprise" ? styles.planTierenterprise : styles.planTierfree}`}>
                    {prog.plan_tier || "Free"}
                  </span>
                </td>
                <td>{prog.activeMembers}</td>
                <td>
                  {prog.contact_email ? (
                    <a href={`mailto:${prog.contact_email}`} className={styles.mailtoLink}>{prog.contact_email}</a>
                  ) : (
                    <span className={styles.noPlan}>—</span>
                  )}
                </td>
                <td>
                  <div className={styles.programActionsWrap}>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => setProgramsMenuOpen(programsMenuOpen === prog.id ? null : prog.id)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {programsMenuOpen === prog.id && (
                      <>
                        <div className={styles.menuBackdrop} onClick={() => setProgramsMenuOpen(null)} />
                        <div className={styles.programMenu}>
                          <button type="button" onClick={() => { viewMembersForProgram(prog.id); setProgramsMenuOpen(null); }}>
                            View Members
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Plan Modal */}
      {assignPlanPlayer && (() => {
        const activeSubs = subsByPlayer[assignPlanPlayer.id] || [];
        const hasPlans = activeSubs.length > 0;
        const isEditingExisting = !!assignTargetSubId && !assignIsSecondPlan;
        const isAddingSecond = assignIsSecondPlan;
        const showPlanForm = !hasPlans || isEditingExisting || isAddingSecond;
        const plansForDropdown = isAddingSecond ? groupPlansByCategory(getPlansForSecondPlan(assignPlanPlayer.id)) : plansByCategory;

        let modalTitle = "Assign Plan";
        if (isAddingSecond) modalTitle = getAddSecondPlanLabel(assignPlanPlayer.id).replace("+ ", "");
        else if (isEditingExisting) modalTitle = "Change Plan";
        else if (hasPlans) modalTitle = "Assign Plan";

        return (
          <div className={styles.overlay} onClick={() => setAssignPlanPlayer(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>{modalTitle} — {getDisplayName(assignPlanPlayer)}</h2>
                <button className={styles.closeBtn} onClick={() => setAssignPlanPlayer(null)} type="button"><X size={20} /></button>
              </div>

              {/* 0 plans: single dropdown. 1 plan: current + Add button. 2 plans: both with Change/Cancel */}
              {hasPlans && !showPlanForm && (
                <div className={styles.modalSection}>
                  <span className={styles.formLabel}>Current Plans</span>
                  <div className={styles.dualPlanCards}>
                    {activeSubs.map((sub, idx) => (
                      <div key={sub.id} className={styles.planCard}>
                        <span className={idx === 0 ? styles.planBadgeStatic : styles.planBadgeSecondStatic}>{sub.plans?.name || "Plan"}</span>
                        <div className={styles.planCardActions}>
                          <button type="button" className={styles.planCardBtn} onClick={() => openAssignPlan(assignPlanPlayer, { targetSubId: sub.id })}>Change</button>
                          <button type="button" className={styles.planCardBtnDanger} onClick={() => handleCancelPlayerPlan(sub.id)} disabled={savingPlan}>Cancel</button>
                        </div>
                      </div>
                    ))}
                    {activeSubs.length === 1 && (
                      <button
                        type="button"
                        className={styles.addSecondPlanBtn}
                        onClick={() => openAssignPlan(assignPlanPlayer, { isSecondPlan: true })}
                      >
                        {getAddSecondPlanLabel(assignPlanPlayer.id)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showPlanForm && (
                <div className={styles.modalSection}>
                  <div className={styles.formField}>
                    <span className={styles.formLabel}>Plan</span>
                    <select className={styles.formInput} value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)}>
                      <option value="">Select a plan...</option>
                      {plansForDropdown.grouped.map((group) => (
                        <optgroup key={group.name} label={group.name}>
                          {group.plans.map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.name} — ${pl.price} ({pl.plan_type})</option>
                          ))}
                        </optgroup>
                      ))}
                      {plansForDropdown.uncategorized.length > 0 && (
                        <optgroup label="Uncategorized">
                          {plansForDropdown.uncategorized.map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.name} — ${pl.price} ({pl.plan_type})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div className={styles.formField}>
                    <span className={styles.formLabel}>Start Billing</span>
                    <input type="date" className={styles.formInput} value={assignBillingStart} onChange={(e) => setAssignBillingStart(e.target.value)} />
                  </div>

                  <div className={styles.formField}>
                    <span className={styles.formLabel}>Discount</span>
                    <select className={styles.formInput} value={assignDiscountId} onChange={(e) => setAssignDiscountId(e.target.value)} disabled={assignComp}>
                      <option value="">No Discount</option>
                      {discounts.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} — {d.discount_type === "percentage" ? `${d.amount}% Off` : `$${d.amount} Off`}</option>
                      ))}
                    </select>
                  </div>

                  <label className={styles.toggleRow}>
                    <span className={styles.toggleLabel}>Complimentary (Free)</span>
                    <button type="button" className={`${styles.compToggle} ${assignComp ? styles.compToggleOn : ""}`} onClick={() => setAssignComp(!assignComp)}>
                      <span className={styles.compToggleThumb} />
                    </button>
                  </label>

                  {isRecurring && (
                    <label className={styles.toggleRow}>
                      <span className={styles.toggleLabel}>Prorate first payment?</span>
                      <button type="button" className={`${styles.compToggle} ${assignProrate ? styles.compToggleOn : ""}`} onClick={() => setAssignProrate(!assignProrate)}>
                        <span className={styles.compToggleThumb} />
                      </button>
                    </label>
                  )}

                  {isRecurring && isFutureBilling && (
                    <label className={styles.toggleRow}>
                      <span className={styles.toggleLabel}>Activate plan today?</span>
                      <button type="button" className={`${styles.compToggle} ${assignActivateToday ? styles.compToggleOn : ""}`} onClick={() => setAssignActivateToday(!assignActivateToday)}>
                        <span className={styles.compToggleThumb} />
                      </button>
                    </label>
                  )}

                  {pricePreview && <div className={styles.pricePreview}>{pricePreview}</div>}
                  {getProratePreview() && <div className={styles.pricePreview}>{getProratePreview()}</div>}

                  <label className={styles.checkboxRow}>
                    <input type="checkbox" checked={assignSendWelcome} onChange={(e) => setAssignSendWelcome(e.target.checked)} />
                    <Bell size={14} />
                    <span>Send welcome notification to player &amp; parent</span>
                  </label>

                  <div className={styles.sectionActions}>
                    <button className={styles.gradientBtn} onClick={handleAssignPlan} disabled={savingPlan || !assignPlanId} type="button">
                      <Save size={14} /> {savingPlan ? "Saving..." : isAddingSecond ? "Add Plan" : hasPlans ? "Change Plan" : "Assign Plan"}
                    </button>
                    {isEditingExisting && (
                      <button className={styles.deactivateBtn} onClick={() => handleCancelPlayerPlan(assignTargetSubId!)} disabled={savingPlan} type="button" style={{ marginLeft: 8 }}>
                        Cancel Plan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Plan History */}
              {(planHistoryTotal > 0 || loadingPlanHistory) && (
                <div className={styles.modalSection}>
                  <span className={styles.modalSectionTitle}>Plan History {planHistoryTotal > 0 ? `(${planHistoryTotal})` : ""}</span>
                  {loadingPlanHistory ? (
                    <span className={styles.noPlan}>Loading...</span>
                  ) : (
                    <>
                      <div className={styles.planHistoryList}>
                        {planHistory.map((h) => (
                          <div key={h.id} className={styles.planHistoryRow}>
                            <span className={styles.planHistoryName}>{h.plans?.name || "Plan"}</span>
                            <span className={styles.planHistoryDates}>
                              {formatDate(h.start_date)} → {h.status === "active" ? "Present" : formatDate(h.end_date)}
                            </span>
                            <span
                              className={`${styles.planHistoryStatus} ${h.status === "active" ? styles.planHistoryActive : h.status === "cancelled" ? styles.planHistoryCancelled : styles.planHistoryExpired}`}
                            >
                              {h.status === "active" ? "Active" : h.status === "cancelled" ? "Cancelled" : "Expired"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {planHistory.length < planHistoryTotal && (
                        <button className={styles.loadMoreBtn} onClick={loadMoreAssignPlanHistory} disabled={loadingPlanHistoryMore} type="button">
                          {loadingPlanHistoryMore ? "Loading..." : `Load more (${planHistoryTotal - planHistory.length} remaining)`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {planToast && <div className={styles.planToast}>{planToast}</div>}

      {/* Offer Spot Modal */}
      {offerSpotPlayer && adminOfferProgramId && adminOfferProgram && (
        <OfferSpotModal
          player={offerSpotPlayer}
          programId={adminOfferProgramId}
          programName={adminOfferProgram.name}
          parentIds={parentsByPlayer[offerSpotPlayer.id] || []}
          adminId={adminId}
          onClose={() => setOfferSpotPlayer(null)}
          onSuccess={(playerName) => {
            setPlanToast(`Offer sent to ${playerName}`);
            setTimeout(() => setPlanToast(null), 3000);
            router.refresh();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          membershipsByProfile={membershipsByProfile}
          programs={programs}
          childrenByParent={childrenByParent}
          parentsByPlayer={parentsByPlayer}
          profilesById={profilesById}
          adminId={adminId}
          onClose={() => setEditingUser(null)}
          onToast={(msg) => { setPlanToast(msg); setTimeout(() => setPlanToast(null), 3000); }}
        />
      )}

      {/* Add Person Modal */}
      {addPersonOpen && (
        <div className={styles.overlay} onClick={() => setAddPersonOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add People</h2>
              <button className={styles.closeBtn} onClick={() => setAddPersonOpen(false)} type="button"><X size={20} /></button>
            </div>
            <p className={styles.modalDesc}>Share a signup link with new users to join your program.</p>
            <div className={styles.inviteSection}>
              {programs.map((pg) => (
                <div key={pg.id} className={styles.inviteRow}>
                  <div>
                    <div className={styles.inviteProgramName}>{pg.name}</div>
                    <div className={styles.inviteLink}>yourdomain.com/join/{(pg as any).slug || pg.name.toLowerCase().replace(/\s+/g, "-")}</div>
                  </div>
                  <button
                    className={styles.copyBtn}
                    onClick={() => handleCopyLink((pg as any).slug || pg.name.toLowerCase().replace(/\s+/g, "-"), pg.name)}
                    type="button"
                  >
                    {copiedLink === pg.name ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
              ))}
              {programs.length === 0 && <p className={styles.noPlan}>No active programs found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Modal Component                                                */
/* ------------------------------------------------------------------ */

interface TimelineItem {
  id: string;
  type: "call" | "meeting" | "email" | "note" | "plan_change" | "offer" | "rating" | "notification";
  label: string;
  body: string;
  authorName: string | null;
  contactName: string | null;
  createdAt: string;
}

interface EditModalProps {
  user: Profile;
  membershipsByProfile: Record<string, Membership[]>;
  programs: ProgramOption[];
  childrenByParent: Record<string, string[]>;
  parentsByPlayer: Record<string, string[]>;
  profilesById: Record<string, Profile>;
  adminId: string;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

function EditModal({ user, membershipsByProfile, programs, childrenByParent, parentsByPlayer, profilesById, adminId, onClose, onToast }: EditModalProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [email] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone_number || "");
  const [birthDate, setBirthDate] = useState(user.birth_date || "");
  const [gender, setGender] = useState(user.gender || "");
  const [address1, setAddress1] = useState(user.address_1 || "");
  const [address2, setAddress2] = useState(user.address_2 || "");
  const [postalCode, setPostalCode] = useState(user.postal_code || "");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [role, setRole] = useState(user.role || "player");
  const [savingRole, setSavingRole] = useState(false);

  const userMemberships = membershipsByProfile[user.id] || [];
  const [localMemberships, setLocalMemberships] = useState(userMemberships);
  const [addProgramId, setAddProgramId] = useState("");
  const [addProgramRole, setAddProgramRole] = useState("player");

  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  const [planHistory, setPlanHistory] = useState<PlanSubscription[]>([]);
  const [planHistoryTotal, setPlanHistoryTotal] = useState(0);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [planHistoryLoadingMore, setPlanHistoryLoadingMore] = useState(false);

  const [communicationsAll, setCommunicationsAll] = useState<TimelineItem[]>([]);
  const [communicationsVisible, setCommunicationsVisible] = useState(5);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [logCommOpen, setLogCommOpen] = useState(false);
  const [logCommType, setLogCommType] = useState<"call" | "meeting" | "email" | "note">("note");
  const [logCommContactId, setLogCommContactId] = useState("");
  const [logCommNote, setLogCommNote] = useState("");
  const [logCommDate, setLogCommDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [logCommSaving, setLogCommSaving] = useState(false);

  useEffect(() => {
    if (user.role !== "player") return;
    let cancelled = false;
    (async () => {
      setPlanHistoryLoading(true);
      const supabase = createClient();
      const { data, count } = await (supabase as any)
        .from("plan_subscriptions")
        .select("id, player_id, plan_id, status, start_date, end_date, created_at, updated_at, plans(id, name, category_id, program_type)", { count: "exact" })
        .eq("player_id", user.id)
        .order("created_at", { ascending: false })
        .range(0, 2);
      if (cancelled) return;
      setPlanHistory(data || []);
      setPlanHistoryTotal(count ?? 0);
      setPlanHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user.id, user.role]);

  async function loadMorePlanHistory() {
    if (user.role !== "player") return;
    setPlanHistoryLoadingMore(true);
    const supabase = createClient();
    const from = planHistory.length;
    const { data } = await (supabase as any)
      .from("plan_subscriptions")
      .select("id, player_id, plan_id, status, start_date, end_date, created_at, updated_at, plans(id, name, category_id, program_type)")
      .eq("player_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, from + 2);
    setPlanHistory((prev) => [...prev, ...(data || [])]);
    setPlanHistoryLoadingMore(false);
  }

  useEffect(() => {
    if (user.role !== "player") return;
    let cancelled = false;
    (async () => {
      setCommunicationsLoading(true);
      const supabase = createClient();
      const parentIds = parentsByPlayer[user.id] || [];
      const recipientIds = [user.id, ...parentIds];

      const [commRes, notifRes, subsRes, offersRes, ratingsRes] = await Promise.all([
        (supabase as any).from("communications").select("id, type, note, created_at, contact_id, author_id, contact:contact_id(full_name, profile_photo_url), author:author_id(full_name)").eq("player_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("notifications").select("id, title, message, notification_type, created_at").in("recipient_id", recipientIds).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("plan_subscriptions").select("id, status, created_at, updated_at, plans(name)").eq("player_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("program_offers").select("id, status, expires_at, created_at, programs(name)").eq("player_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("coach_player_ratings").select("id, maturity, socially, work_ethic, created_at").eq("player_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const items: TimelineItem[] = [];
      for (const c of commRes.data || []) {
        items.push({
          id: `comm-${c.id}`,
          type: c.type,
          label: c.type === "note" ? "Note" : c.type === "call" ? "Call" : c.type === "meeting" ? "Meeting" : "Email",
          body: c.note,
          authorName: c.author?.full_name ?? null,
          contactName: c.contact?.full_name ?? null,
          createdAt: c.created_at,
        });
      }
      for (const n of notifRes.data || []) {
        items.push({
          id: `notif-${n.id}`,
          type: "notification",
          label: n.title || "Notification",
          body: n.message || "",
          authorName: null,
          contactName: null,
          createdAt: n.created_at,
        });
      }
      for (const s of subsRes.data || []) {
        const planName = s.plans?.name || "Plan";
        items.push({
          id: `sub-${s.id}`,
          type: "plan_change",
          label: s.status === "active" ? "Plan assigned" : "Plan cancelled",
          body: s.status === "active" ? `Plan assigned: ${planName}` : `Plan cancelled: ${planName}`,
          authorName: null,
          contactName: null,
          createdAt: s.status === "active" ? s.created_at : s.updated_at || s.created_at,
        });
      }
      for (const o of offersRes.data || []) {
        const progName = o.programs?.name || "Program";
        const exp = o.expires_at ? new Date(o.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
        items.push({
          id: `offer-${o.id}`,
          type: "offer",
          label: "Offer sent",
          body: `Offer sent for ${progName}. Expires ${exp}.`,
          authorName: null,
          contactName: null,
          createdAt: o.created_at,
        });
      }
      for (const r of ratingsRes.data || []) {
        items.push({
          id: `rating-${r.id}`,
          type: "rating",
          label: "Coach rating",
          body: `Maturity: ${r.maturity}, Socially: ${r.socially}, Work ethic: ${r.work_ethic}`,
          authorName: null,
          contactName: null,
          createdAt: r.created_at,
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCommunicationsAll(items);
      setCommunicationsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user.id, user.role, parentsByPlayer]);

  function loadMoreCommunications() {
    setCommunicationsVisible((prev) => prev + 5);
  }

  async function handleLogCommunication() {
    if (!logCommNote.trim() || !logCommContactId) return;
    setLogCommSaving(true);
    const result = await logCommunication({
      playerId: user.id,
      contactId: logCommContactId,
      authorId: adminId,
      type: logCommType,
      note: logCommNote.trim(),
      createdAt: new Date(logCommDate).toISOString(),
    });
    setLogCommSaving(false);
    if (result.ok) {
      const contact = profilesById[logCommContactId];
      const contactName = contact ? getDisplayName(contact) : "Unknown";
      setCommunicationsAll((prev) => [{
        id: `comm-new-${Date.now()}`,
        type: logCommType,
        label: logCommType === "note" ? "Note" : logCommType === "call" ? "Call" : logCommType === "meeting" ? "Meeting" : "Email",
        body: logCommNote.trim(),
        authorName: null,
        contactName,
        createdAt: new Date(logCommDate).toISOString(),
      }, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLogCommOpen(false);
      setLogCommNote("");
      setLogCommContactId("");
      setLogCommDate(new Date().toISOString().split("T")[0]);
      onToast?.("Communication logged");
    } else {
      alert(result.error || "Failed to log");
    }
  }

  function formatRelativeTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  }

  function getCommIcon(type: TimelineItem["type"]) {
    switch (type) {
      case "call": return <Phone size={18} />;
      case "meeting": return <Users size={18} />;
      case "email": return <Mail size={18} />;
      case "note": return <FileText size={18} />;
      case "notification": return <Bell size={18} />;
      case "plan_change": return <CreditCard size={18} />;
      case "offer": return <Star size={18} />;
      case "rating": return <Award size={18} />;
      default: return <FileText size={18} />;
    }
  }

  async function handleSaveInfo() {
    setSavingInfo(true);
    setInfoMsg(null);
    const supabase = createClient();
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await (supabase as any).from("profiles").update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      full_name: fullName || null,
      phone_number: phone.trim() || null,
      birth_date: birthDate || null,
      gender: gender || null,
      address_1: address1.trim() || null,
      address_2: address2.trim() || null,
      postal_code: postalCode.trim() || null,
    }).eq("id", user.id);
    setSavingInfo(false);
    if (error) { setInfoMsg(`Error: ${error.message}`); return; }
    setInfoMsg("Saved!");
    setTimeout(() => setInfoMsg(null), 2000);
    router.refresh();
  }

  async function handleSaveRole() {
    setSavingRole(true);
    const { error } = await updateUserRole(user.id, role);
    setSavingRole(false);
    if (error) { alert(`Role update failed: ${error}`); return; }
    router.refresh();
  }

  async function handleRemoveMembership(membershipId: string) {
    const supabase = createClient();
    await (supabase as any).from("program_memberships").delete().eq("id", membershipId);
    setLocalMemberships((prev) => prev.filter((m) => m.id !== membershipId));
    router.refresh();
  }

  async function handleAddMembership() {
    if (!addProgramId) return;
    const supabase = createClient();
    const { data, error } = await (supabase as any).from("program_memberships").insert({
      id: crypto.randomUUID(),
      profile_id: user.id,
      program_id: addProgramId,
      program_role: addProgramRole,
      is_active: true,
    }).select("id, profile_id, program_id, program_role, is_active, programs(id, name)").single();
    if (error) { alert(`Failed: ${error.message}`); return; }
    if (data) setLocalMemberships((prev) => [...prev, data]);
    setAddProgramId("");
    router.refresh();
  }

  async function handleLinkAccount() {
    if (!linkEmail.trim()) return;
    setLinking(true);
    setLinkMsg(null);
    const supabase = createClient();
    const { data: target } = await (supabase as any).from("profiles").select("id, role").eq("email", linkEmail.trim().toLowerCase()).maybeSingle();
    if (!target) { setLinkMsg("No account found with that email."); setLinking(false); return; }

    const isParent = user.role === "parent";
    const parentId = isParent ? user.id : target.id;
    const playerId = isParent ? target.id : user.id;

    const { error } = await (supabase as any).from("parent_player_relationships").insert({ parent_id: parentId, player_id: playerId });
    setLinking(false);
    if (error) { setLinkMsg(`Failed: ${error.message}`); return; }
    setLinkMsg("Linked!");
    setLinkEmail("");
    router.refresh();
  }

  const linkedChildren = childrenByParent[user.id] || [];
  const linkedParents = parentsByPlayer[user.id] || [];
  const linkedIds = user.role === "parent" ? linkedChildren : linkedParents;
  const linkedLabel = user.role === "parent" ? "Linked Players" : "Linked Parents";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{getDisplayName(user)}</h2>
          <button className={styles.closeBtn} onClick={onClose} type="button"><X size={20} /></button>
        </div>

        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>Personal Information</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <span className={styles.formLabel}>First Name</span>
              <input className={styles.formInput} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Last Name</span>
              <input className={styles.formInput} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Email</span>
              <input className={`${styles.formInput} ${styles.formInputReadonly}`} value={email} readOnly />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Phone</span>
              <input className={styles.formInput} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Birth Date</span>
              <input className={styles.formInput} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Gender</span>
              <select className={styles.formInput} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="not-specified">Not Specified</option>
              </select>
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Address 1</span>
              <input className={styles.formInput} value={address1} onChange={(e) => setAddress1(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Address 2</span>
              <input className={styles.formInput} value={address2} onChange={(e) => setAddress2(e.target.value)} />
            </div>
            <div className={styles.formField}>
              <span className={styles.formLabel}>Postal Code</span>
              <input className={styles.formInput} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
          </div>
          <div className={styles.sectionActions}>
            <button className={styles.gradientBtn} onClick={handleSaveInfo} disabled={savingInfo} type="button">
              <Save size={14} /> {savingInfo ? "Saving..." : "Save"}
            </button>
            {infoMsg && <span className={styles.inlineMsg}>{infoMsg}</span>}
          </div>
        </div>

        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>Role &amp; Programs</h3>
          <div className={styles.roleRow}>
            <div className={styles.formField} style={{ flex: 1 }}>
              <span className={styles.formLabel}>Global Role</span>
              <select className={styles.formInput} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button className={styles.gradientBtn} onClick={handleSaveRole} disabled={savingRole} type="button">
              <Save size={14} /> {savingRole ? "Saving..." : "Save Role"}
            </button>
          </div>

          <div className={styles.formField} style={{ marginTop: 16 }}>
            <span className={styles.formLabel}>Program Memberships</span>
            {localMemberships.length === 0 && <span className={styles.noPlan}>No memberships</span>}
            {localMemberships.map((m) => (
              <div key={m.id} className={styles.membershipRow}>
                <span>{m.programs?.name || "Unknown"}</span>
                <span className={styles.membershipRole}>{m.program_role}</span>
                <button className={styles.removeBtn} onClick={() => handleRemoveMembership(m.id)} type="button"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className={styles.addMembershipRow}>
            <select className={styles.formInput} value={addProgramId} onChange={(e) => setAddProgramId(e.target.value)}>
              <option value="">Add to program...</option>
              {programs.map((pg) => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </select>
            <select className={styles.formInput} value={addProgramRole} onChange={(e) => setAddProgramRole(e.target.value)} style={{ maxWidth: 120 }}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className={styles.gradientBtn} onClick={handleAddMembership} disabled={!addProgramId} type="button">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>{linkedLabel}</h3>
          {linkedIds.length === 0 && <span className={styles.noPlan}>No linked accounts</span>}
          {linkedIds.map((id) => {
            const linked = profilesById[id];
            if (!linked) return null;
            return (
              <div key={id} className={styles.linkedAccount}>
                <div className={styles.linkedAccountInfo}>
                  {renderAvatar(linked, 28)}
                  <div>
                    <span className={styles.linkedAccountName}>{getDisplayName(linked)}</span>
                    <span className={styles.linkedAccountRole}>{linked.role}</span>
                  </div>
                </div>
                <button className={styles.editBtn} onClick={() => { /* could open nested edit */ }} type="button"><UserPen size={14} /></button>
              </div>
            );
          })}
          <div className={styles.linkRow}>
            <input className={styles.formInput} placeholder="Email to link..." value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} style={{ flex: 1 }} />
            <button className={styles.gradientBtn} onClick={handleLinkAccount} disabled={linking || !linkEmail.trim()} type="button">
              <UserPlus size={14} /> {linking ? "Linking..." : "Link"}
            </button>
          </div>
          {linkMsg && <span className={styles.inlineMsg}>{linkMsg}</span>}
        </div>

        {user.role === "player" && (
          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Plan History {planHistoryTotal > 0 ? `(${planHistoryTotal})` : ""}</h3>
            {planHistoryLoading ? (
              <span className={styles.noPlan}>Loading...</span>
            ) : planHistory.length === 0 ? (
              <span className={styles.noPlan}>No plan history</span>
            ) : (
              <>
                <div className={styles.planHistoryList}>
                  {planHistory.map((h) => (
                    <div key={h.id} className={styles.planHistoryRow}>
                      <span className={styles.planHistoryName}>{h.plans?.name || "Plan"}</span>
                      <span className={styles.planHistoryDates}>
                        {formatDate(h.start_date)} → {h.status === "active" ? "Present" : formatDate(h.end_date)}
                      </span>
                      <span
                        className={`${styles.planHistoryStatus} ${h.status === "active" ? styles.planHistoryActive : h.status === "cancelled" ? styles.planHistoryCancelled : styles.planHistoryExpired}`}
                      >
                        {h.status === "active" ? "Active" : h.status === "cancelled" ? "Cancelled" : "Expired"}
                      </span>
                    </div>
                  ))}
                </div>
                {planHistory.length < planHistoryTotal && (
                  <button className={styles.loadMoreBtn} onClick={loadMorePlanHistory} disabled={planHistoryLoadingMore} type="button">
                    {planHistoryLoadingMore ? "Loading..." : `Load more (${planHistoryTotal - planHistory.length} remaining)`}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {user.role === "player" && (
          <div className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>Communications ({communicationsAll.length})</h3>
            <button type="button" className={styles.ghostBtn} onClick={() => setLogCommOpen(!logCommOpen)} style={{ marginBottom: 12 }}>
              + Log Communication
            </button>
            {logCommOpen && (
              <div className={styles.logCommForm}>
                <div className={styles.templateSelector}>
                  {(["note", "call", "meeting", "email"] as const).map((t) => (
                    <button key={t} type="button" className={`${styles.templatePill} ${styles.commTypePill} ${logCommType === t ? styles.templatePillActive : ""}`} onClick={() => setLogCommType(t)}>
                      {t === "note" && <FileText size={14} />}
                      {t === "call" && <Phone size={14} />}
                      {t === "meeting" && <Users size={14} />}
                      {t === "email" && <Mail size={14} />}
                      {t === "note" ? "Note" : t === "call" ? "Call" : t === "meeting" ? "Meeting" : "Email"}
                    </button>
                  ))}
                </div>
                <div className={styles.formField}>
                  <span className={styles.formLabel}>Who was contacted</span>
                  <select className={styles.formInput} value={logCommContactId} onChange={(e) => setLogCommContactId(e.target.value)}>
                    <option value="">Select...</option>
                    <option value={user.id}>{getDisplayName(user)} (Player)</option>
                    {linkedParents.map((pid) => {
                      const p = profilesById[pid];
                      return p ? <option key={pid} value={pid}>{getDisplayName(p)} (Parent)</option> : null;
                    })}
                  </select>
                </div>
                <div className={styles.formField}>
                  <span className={styles.formLabel}>Note (required)</span>
                  <textarea className={styles.formInput} rows={3} value={logCommNote} onChange={(e) => setLogCommNote(e.target.value)} placeholder="Enter note..." />
                </div>
                <div className={styles.formField}>
                  <span className={styles.formLabel}>Date</span>
                  <input type="date" className={styles.formInput} value={logCommDate} onChange={(e) => setLogCommDate(e.target.value)} />
                </div>
                <div className={styles.sectionActions}>
                  <button className={styles.gradientBtn} onClick={handleLogCommunication} disabled={logCommSaving || !logCommNote.trim() || !logCommContactId} type="button">
                    {logCommSaving ? "Saving..." : "Save"}
                  </button>
                  <button className={styles.deactivateBtn} onClick={() => { setLogCommOpen(false); setLogCommNote(""); setLogCommContactId(""); }} type="button" style={{ marginLeft: 8 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {communicationsLoading ? (
              <span className={styles.noPlan}>Loading...</span>
            ) : communicationsAll.length === 0 ? (
              <span className={styles.noPlan}>No communications yet</span>
            ) : (
              <>
                <div className={styles.commTimeline}>
                  {communicationsAll.slice(0, communicationsVisible).map((item) => (
                    <div key={item.id} className={styles.commItem}>
                      <div className={`${styles.commIcon} ${["call", "meeting", "email", "note"].includes(item.type) ? styles.commIconManual : ""}`}>
                        {getCommIcon(item.type)}
                      </div>
                      <div className={styles.commContent}>
                        <span className={styles.commLabel}>{item.label}</span>
                        {item.contactName && <span className={styles.commPill}>{item.contactName}</span>}
                        <p className={styles.commBody}>{item.body}</p>
                        <span className={styles.commMeta}>
                          {item.authorName && `${item.authorName} · `}{formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {communicationsVisible < communicationsAll.length && (
                  <button className={styles.loadMoreBtn} onClick={loadMoreCommunications} type="button">
                    Load more ({communicationsAll.length - communicationsVisible} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className={styles.modalSection}>
          <button className={styles.deactivateBtn} onClick={() => alert("Coming soon")} type="button">
            Deactivate Account
          </button>
        </div>
      </div>
    </div>
  );
}
