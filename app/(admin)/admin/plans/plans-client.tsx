"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, MoreHorizontal, Repeat, Package, X, Info, Building2, Users, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./plans.module.css";

/* ─── Types ─── */

interface Category {
  id: string;
  name: string;
  program_type: string | null;
}

interface SessionAllowances {
  onfield: Record<string, number>;
  virtual: Record<string, number>;
  solo: Record<string, number>;
}

interface B2bFeatures {
  solo_access: boolean;
  virtual_1on1: boolean;
  group_virtual: boolean;
  white_label: boolean;
}

interface Plan {
  id: string;
  name: string;
  plan_type: "recurring" | "package" | "bundle";
  price: number;
  billing_period: string | null;
  commitment_length: number | null;
  short_description: string | null;
  category_id: string | null;
  program_type: string | null;
  session_allowances: SessionAllowances | null;
  solo_access: boolean;
  virtual_access: boolean;
  subscriber_count: number;
  plan_recipient: "player" | "program" | null;
  pricing_model: string | null;
  max_players: number | null;
  includes_white_label: boolean | null;
  b2b_features: B2bFeatures | null;
  cancellation_fee: number | null;
  cancellation_policy_text: string | null;
  is_featured: boolean;
}

interface Subscription {
  id: string;
  player_id: string;
  plan_id: string;
  status: string;
  rating_requested: boolean;
  rating_completed: boolean;
  player_name: string;
}

interface Discount {
  id: string;
  name: string;
  amount: number;
  discount_type: "flat" | "percentage";
  duration_type: "forever" | "once" | "repeating";
  duration_months: number | null;
  description: string | null;
  program_type: string | null;
  is_active: boolean;
}

type ProgramTab = "champions" | "homegrown" | "discounts";

interface Props {
  profileId: string;
}

/* ─── Allowance Config ─── */

const ONFIELD_TYPES = [
  { key: "one_on_one", label: "1:1 Sessions" },
  { key: "tec_tac", label: "Tec Tac" },
  { key: "sprint_training", label: "Sprint Training" },
  { key: "strength_conditioning", label: "Strength & Conditioning" },
];

const VIRTUAL_1ON1_TYPES = [
  { key: "cpp", label: "CPP" },
  { key: "college_advising", label: "College Advising" },
  { key: "psychologist", label: "Psychologist" },
  { key: "nutrition", label: "Nutrition" },
];

const VIRTUAL_GROUP_TYPES = [
  { key: "pro_player_stories", label: "Pro Player Stories" },
  { key: "group_film_analysis", label: "Group Film Analysis" },
];

const ALL_VIRTUAL_TYPES = [...VIRTUAL_1ON1_TYPES, ...VIRTUAL_GROUP_TYPES];

const SOLO_TYPES = [
  { key: "technical", label: "Technical" },
  { key: "tactical", label: "Tactical" },
  { key: "physical", label: "Physical" },
  { key: "mental", label: "Mental" },
];

const COMMITMENT_OPTIONS = [
  { value: "", label: "None" },
  { value: "3", label: "3 Months" },
  { value: "6", label: "6 Months" },
  { value: "12", label: "12 Months" },
];

type AllowanceEntry = { qty: string; unlimited: boolean };
type AllowanceMap = Record<string, AllowanceEntry>;

function emptyMap(types: { key: string }[]): AllowanceMap {
  return Object.fromEntries(types.map((t) => [t.key, { qty: "", unlimited: false }]));
}

function allowanceMapFromDb(dbMap: Record<string, number> | undefined, keys: { key: string }[]): AllowanceMap {
  const m: AllowanceMap = {};
  for (const { key } of keys) {
    const v = dbMap?.[key] ?? 0;
    if (v === -1) m[key] = { qty: "", unlimited: true };
    else if (v > 0) m[key] = { qty: String(v), unlimited: false };
    else m[key] = { qty: "", unlimited: false };
  }
  return m;
}

function allowanceMapToDb(m: AllowanceMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    if (v.unlimited) out[k] = -1;
    else if (v.qty && parseInt(v.qty) > 0) out[k] = parseInt(v.qty);
    else out[k] = 0;
  }
  return out;
}

/* ─── Compact summary for plan rows ─── */

const SHORT_LABELS: Record<string, string> = {
  one_on_one: "1:1",
  tec_tac: "Tec Tac",
  sprint_training: "Sprint",
  strength_conditioning: "S&C",
  cpp: "CPP",
  college_advising: "College",
  psychologist: "Psych",
  nutrition: "Nutrition",
  pro_player_stories: "Pro Stories",
  group_film_analysis: "Film",
};

function buildSummary(plan: Plan): string[] {
  const parts: string[] = [];
  const sa = plan.session_allowances;
  if (sa) {
    const all = { ...(sa.onfield || {}), ...(sa.virtual || {}) };
    for (const [k, v] of Object.entries(all)) {
      if (v === -1) parts.push(`${SHORT_LABELS[k] || k}: ∞`);
      else if (v > 0) parts.push(`${SHORT_LABELS[k] || k}: ${v}`);
    }
  }
  if (plan.virtual_access) parts.push("Virtual ✓");
  if (plan.solo_access) parts.push("Solo ✓");
  return parts;
}

/* ─── Tooltip texts ─── */

const TOOLTIPS: Record<string, string> = {
  price: "For packages, this is the one-time total. For recurring, this is the per-period price.",
  billing_period: "How often the member is charged",
  commitment: "The minimum time a member must stay on this plan before cancelling",
  cancellation_fee: "A fixed fee charged if the member cancels before their commitment period ends. Leave blank for no fee.",
  virtual: "Unlocks virtual 1:1 and group sessions for this plan",
  solo: "Unlocks the solo training page for this plan",
};

/* ─── Component ─── */

export default function PlansClient({ profileId }: Props) {
  void profileId;
  const supabase = createClient();

  const [tab, setTab] = useState<ProgramTab>("champions");
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planStep, setPlanStep] = useState<1 | 2>(1);
  const [planType, setPlanType] = useState<"recurring" | "package" | null>(null);
  const [planName, setPlanName] = useState("");
  const [planCategoryId, setPlanCategoryId] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planBillingPeriod, setPlanBillingPeriod] = useState("monthly");
  const [planCommitment, setPlanCommitment] = useState("");
  const [planCancellationFee, setPlanCancellationFee] = useState("");
  const [planCancellationPolicy, setPlanCancellationPolicy] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  const [onfieldAllowances, setOnfieldAllowances] = useState<AllowanceMap>(() => emptyMap(ONFIELD_TYPES));
  const [virtualAllowances, setVirtualAllowances] = useState<AllowanceMap>(() => emptyMap(ALL_VIRTUAL_TYPES));
  const [soloAllowances, setSoloAllowances] = useState<AllowanceMap>(() => emptyMap(SOLO_TYPES));
  const [virtualAccess, setVirtualAccess] = useState(false);
  const [soloAccess, setSoloAccess] = useState(false);

  const [planRecipient, setPlanRecipient] = useState<"player" | "program">("player");
  const [pricingModel, setPricingModel] = useState<"per_player" | "flat_monthly" | "per_feature">("per_player");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [b2bSoloAccess, setB2bSoloAccess] = useState(false);
  const [b2bVirtual1on1, setB2bVirtual1on1] = useState(false);
  const [b2bGroupVirtual, setB2bGroupVirtual] = useState(false);
  const [b2bWhiteLabel, setB2bWhiteLabel] = useState(false);
  const [soloFee, setSoloFee] = useState("");
  const [virtualFee, setVirtualFee] = useState("");

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [subsModalPlan, setSubsModalPlan] = useState<Plan | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [cancellingSubId, setCancellingSubId] = useState<string | null>(null);

  const [discountsList, setDiscountsList] = useState<Discount[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);
  const [discountName, setDiscountName] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountTypeField, setDiscountTypeField] = useState<"flat" | "percentage">("flat");
  const [discountDuration, setDiscountDuration] = useState<"forever" | "once" | "repeating">("forever");
  const [discountDurationMonths, setDiscountDurationMonths] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [discountActive, setDiscountActive] = useState(true);
  const [discountProgramType, setDiscountProgramType] = useState<string | null>(null);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [openDiscountMenu, setOpenDiscountMenu] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);

  const [visibleTip, setVisibleTip] = useState<string | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleTip = useCallback((key: string) => {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    setVisibleTip((prev) => {
      if (prev === key) return null;
      tipTimerRef.current = setTimeout(() => setVisibleTip(null), 4000);
      return key;
    });
  }, []);

  const programTypeFilter = tab === "champions" ? "Champions Premier" : null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let catQuery = (supabase as any).from("plan_categories").select("id, name, program_type").order("name");
      if (programTypeFilter) {
        catQuery = catQuery.eq("program_type", programTypeFilter);
      } else {
        catQuery = catQuery.is("program_type", null);
      }
      const { data: catData } = await catQuery;
      setCategories(catData || []);

      let planQuery = (supabase as any)
        .from("plans")
        .select("id, name, plan_type, price, billing_period, commitment_length, short_description, category_id, program_type, session_allowances, solo_access, virtual_access, plan_recipient, pricing_model, max_players, includes_white_label, b2b_features, cancellation_fee, cancellation_policy_text, is_featured")
        .order("name");
      if (programTypeFilter) {
        planQuery = planQuery.eq("program_type", programTypeFilter);
      } else {
        planQuery = planQuery.is("program_type", null);
      }
      const { data: planData } = await planQuery;
      const planRows = (planData || []) as Plan[];

      const planIds = planRows.map((p) => p.id);
      const subCounts: Record<string, number> = {};
      if (planIds.length > 0) {
        for (const pid of planIds) {
          const { count } = await (supabase as any)
            .from("plan_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("plan_id", pid)
            .eq("status", "active");
          subCounts[pid] = count || 0;
        }
      }

      setPlans(planRows.map((p) => ({ ...p, subscriber_count: subCounts[p.id] || 0 })));
    } catch {
      /* */
    }
    setLoading(false);
  }, [supabase, programTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Category CRUD ─── */

  async function handleCreateCategory() {
    if (!categoryName.trim()) return;
    setSavingCategory(true);
    const { error } = await (supabase as any).from("plan_categories").insert({
      name: categoryName.trim(),
      program_type: programTypeFilter,
    });
    setSavingCategory(false);
    if (error) { showToast("Failed to create category"); return; }
    showToast("Category created");
    setCategoryName("");
    setShowCategoryModal(false);
    fetchData();
  }

  async function handleUpdateCategory() {
    if (!editingCategory || !editCategoryName.trim()) return;
    setSavingCategory(true);
    const { error } = await (supabase as any)
      .from("plan_categories")
      .update({ name: editCategoryName.trim() })
      .eq("id", editingCategory.id);
    setSavingCategory(false);
    if (error) { showToast("Failed to update category"); return; }
    showToast("Category updated");
    setEditingCategory(null);
    setEditCategoryName("");
    fetchData();
  }

  async function handleDeleteCategory(cat: Category) {
    if (!window.confirm(`Delete "${cat.name}"? Plans in this category will become uncategorized.`)) return;
    await (supabase as any).from("plans").update({ category_id: null }).eq("category_id", cat.id);
    const { error } = await (supabase as any).from("plan_categories").delete().eq("id", cat.id);
    if (error) { showToast("Failed to delete category"); return; }
    showToast("Category deleted");
    setOpenMenu(null);
    fetchData();
  }

  /* ─── Plan CRUD ─── */

  function resetPlanForm() {
    setPlanStep(1);
    setPlanType(null);
    setPlanName("");
    setPlanCategoryId("");
    setPlanPrice("");
    setPlanBillingPeriod("monthly");
    setPlanCommitment("");
    setPlanCancellationFee("");
    setPlanCancellationPolicy("");
    setOnfieldAllowances(emptyMap(ONFIELD_TYPES));
    setVirtualAllowances(emptyMap(ALL_VIRTUAL_TYPES));
    setSoloAllowances(emptyMap(SOLO_TYPES));
    setVirtualAccess(false);
    setSoloAccess(false);
    setEditingPlan(null);
    setVisibleTip(null);
    setPlanRecipient("player");
    setPricingModel("per_player");
    setMaxPlayers("");
    setPlanDescription("");
    setB2bSoloAccess(false);
    setB2bVirtual1on1(false);
    setB2bGroupVirtual(false);
    setB2bWhiteLabel(false);
    setSoloFee("");
    setVirtualFee("");
  }

  function openCreatePlan() {
    resetPlanForm();
    setShowPlanModal(true);
  }

  function openEditPlan(plan: Plan) {
    setPlanStep(2);
    setPlanType(plan.plan_type);
    setPlanName(plan.name);
    setPlanCategoryId(plan.category_id || "");
    setPlanPrice(String(plan.price || ""));
    setPlanBillingPeriod(plan.billing_period || "monthly");
    setPlanCommitment(plan.commitment_length != null ? String(plan.commitment_length) : "");
    setPlanCancellationFee(plan.cancellation_fee != null ? String(plan.cancellation_fee) : "");
    setPlanCancellationPolicy(plan.cancellation_policy_text || "");
    setOnfieldAllowances(allowanceMapFromDb(plan.session_allowances?.onfield, ONFIELD_TYPES));
    setVirtualAllowances(allowanceMapFromDb(plan.session_allowances?.virtual, ALL_VIRTUAL_TYPES));
    setSoloAllowances(allowanceMapFromDb(plan.session_allowances?.solo, SOLO_TYPES));
    setVirtualAccess(plan.virtual_access ?? false);
    setSoloAccess(plan.solo_access ?? false);
    setPlanRecipient(plan.plan_recipient || "player");
    setPricingModel((plan.pricing_model as "per_player" | "flat_monthly" | "per_feature") || "per_player");
    setMaxPlayers(plan.max_players != null ? String(plan.max_players) : "");
    setPlanDescription(plan.short_description || "");
    setB2bSoloAccess(plan.b2b_features?.solo_access ?? false);
    setB2bVirtual1on1(plan.b2b_features?.virtual_1on1 ?? false);
    setB2bGroupVirtual(plan.b2b_features?.group_virtual ?? false);
    setB2bWhiteLabel(plan.b2b_features?.white_label ?? false);
    setSoloFee("");
    setVirtualFee("");
    setEditingPlan(plan);
    setShowPlanModal(true);
    setOpenMenu(null);
    setVisibleTip(null);
  }

  async function handleSavePlan() {
    if (!planName.trim()) { showToast("Plan name is required"); return; }
    if (!planPrice || parseFloat(planPrice) < 0) { showToast("Valid price is required"); return; }
    if (planRecipient === "player" && planType === "recurring" && !planBillingPeriod) { showToast("Billing period is required"); return; }

    setSavingPlan(true);

    const isB2b = planRecipient === "program";

    if (isB2b) {
      const b2bFeatures: B2bFeatures = {
        solo_access: b2bSoloAccess,
        virtual_1on1: b2bVirtual1on1,
        group_virtual: b2bGroupVirtual,
        white_label: b2bWhiteLabel,
      };

      const payload: Record<string, unknown> = {
        name: planName.trim(),
        plan_type: "recurring",
        price: parseFloat(planPrice),
        billing_period: planBillingPeriod || "monthly",
        commitment_length: planCommitment ? parseInt(planCommitment) : null,
        category_id: planCategoryId || null,
        program_type: programTypeFilter,
        short_description: planDescription.trim() || null,
        plan_recipient: "program",
        pricing_model: pricingModel,
        max_players: pricingModel === "per_player" && maxPlayers ? parseInt(maxPlayers) : null,
        includes_white_label: b2bWhiteLabel,
        b2b_features: b2bFeatures,
        solo_access: b2bSoloAccess,
        virtual_access: b2bVirtual1on1 || b2bGroupVirtual,
        session_allowances: null,
      };

      let error;
      if (editingPlan) {
        ({ error } = await (supabase as any).from("plans").update(payload).eq("id", editingPlan.id));
      } else {
        ({ error } = await (supabase as any).from("plans").insert(payload));
      }

      setSavingPlan(false);
      if (error) { showToast(editingPlan ? "Failed to update plan" : "Failed to create plan"); return; }
    } else {
      const zeroVirtual = Object.fromEntries(ALL_VIRTUAL_TYPES.map((t) => [t.key, 0]));
      const zeroSolo = Object.fromEntries(SOLO_TYPES.map((t) => [t.key, 0]));

      const sessionAllowances: SessionAllowances = {
        onfield: allowanceMapToDb(onfieldAllowances),
        virtual: virtualAccess ? allowanceMapToDb(virtualAllowances) : zeroVirtual,
        solo: soloAccess ? allowanceMapToDb(soloAllowances) : zeroSolo,
      };

      const payload: Record<string, unknown> = {
        name: planName.trim(),
        plan_type: planType,
        price: parseFloat(planPrice),
        billing_period: planType === "recurring" ? planBillingPeriod : null,
        commitment_length: planType === "recurring" && planCommitment ? parseInt(planCommitment) : null,
        category_id: planCategoryId || null,
        program_type: programTypeFilter,
        session_allowances: sessionAllowances,
        solo_access: soloAccess,
        virtual_access: virtualAccess,
        plan_recipient: "player",
        pricing_model: null,
        max_players: null,
        includes_white_label: false,
        b2b_features: null,
        cancellation_fee: planCancellationFee && parseFloat(planCancellationFee) >= 0 ? parseFloat(planCancellationFee) : null,
        cancellation_policy_text: planCancellationPolicy.trim() || null,
      };

      let error;
      if (editingPlan) {
        ({ error } = await (supabase as any).from("plans").update(payload).eq("id", editingPlan.id));
      } else {
        ({ error } = await (supabase as any).from("plans").insert(payload));
      }

      setSavingPlan(false);
      if (error) { showToast(editingPlan ? "Failed to update plan" : "Failed to create plan"); return; }
    }

    showToast(editingPlan ? "Plan updated" : "Plan created");
    setShowPlanModal(false);
    fetchData();
  }

  async function handleToggleFeatured(plan: Plan) {
    setTogglingFeatured(plan.id);
    const next = !plan.is_featured;
    const { error } = await (supabase as any)
      .from("plans")
      .update({ is_featured: next })
      .eq("id", plan.id);
    setTogglingFeatured(null);
    if (error) {
      showToast("Failed to update");
      return;
    }
    showToast(next ? "Plan marked as Most Popular" : "Most Popular badge removed");
    fetchData();
  }

  async function handleDeletePlan(plan: Plan) {
    if (!window.confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("plans").delete().eq("id", plan.id);
    if (error) { showToast("Failed to delete plan"); return; }
    showToast("Plan deleted");
    setOpenMenu(null);
    fetchData();
  }

  /* ─── Subscription management ─── */

  async function openSubscribers(plan: Plan) {
    setSubsModalPlan(plan);
    setOpenMenu(null);
    setLoadingSubs(true);
    const { data } = await (supabase as any)
      .from("plan_subscriptions")
      .select("id, player_id, plan_id, status, rating_requested, rating_completed")
      .eq("plan_id", plan.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const rows = (data || []) as Subscription[];
    const playerIds = rows.map((r) => r.player_id);
    let nameMap: Record<string, string> = {};
    if (playerIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", playerIds);
      for (const p of profiles || []) {
        nameMap[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown";
      }
    }
    setSubscriptions(rows.map((r) => ({ ...r, player_name: nameMap[r.player_id] || "Unknown" })));
    setLoadingSubs(false);
  }

  async function handleCancelSubscription(sub: Subscription) {
    if (!subsModalPlan) return;
    if (!window.confirm(`Cancel ${sub.player_name}'s subscription to ${subsModalPlan.name}?`)) return;

    setCancellingSubId(sub.id);

    await (supabase as any)
      .from("plan_subscriptions")
      .update({ status: "cancelled", rating_requested: true })
      .eq("id", sub.id);

    const planProgramType = subsModalPlan.program_type;
    console.log("[handleCancelSubscription] plan program_type:", planProgramType, "(null/empty = Homegrown, string = on-field)");

    let coaches: { id: string }[] = [];

    if (planProgramType == null || planProgramType === "") {
      // Homegrown: query ALL coaches (no program filter)
      const { data } = await (supabase as any).from("profiles").select("id").eq("role", "coach");
      coaches = data || [];
      console.log("[handleCancelSubscription] Homegrown plan: fetched", coaches.length, "coaches (all)");
    } else {
      // On-field: get coaches via program_memberships for programs matching program_type
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
      console.log("[handleCancelSubscription] On-field plan:", planProgramType, "| programs:", programIds.length, "| coaches:", coaches.length);
    }

    const ratingPayload = {
      notification_type: "rating_request" as const,
      title: "Rate a Player",
      message: `${sub.player_name} completed their ${subsModalPlan.name} plan. Please rate their development.`,
      is_read: false,
      data: {
        subscription_id: sub.id,
        player_id: sub.player_id,
        player_name: sub.player_name,
        plan_name: subsModalPlan.name,
      },
    };

    if (coaches.length > 0) {
      const coachNotifs = coaches.map((c: { id: string }) => ({
        recipient_id: c.id,
        recipient_role: "coach",
        ...ratingPayload,
      }));
      console.log("[handleCancelSubscription] Inserting", coachNotifs.length, "coach notifications");
      const { error: coachErr } = await (supabase as any).from("notifications").insert(coachNotifs);
      if (coachErr) console.error("[handleCancelSubscription] Coach notification insert error:", coachErr);
    } else {
      console.log("[handleCancelSubscription] No coaches found — skipping coach notifications");
    }

    const { data: admins } = await (supabase as any).from("profiles").select("id").eq("role", "admin");
    const adminList = admins || [];
    if (adminList.length > 0) {
      const adminNotifs = adminList.map((a: { id: string }) => ({
        recipient_id: a.id,
        recipient_role: "admin",
        ...ratingPayload,
      }));
      console.log("[handleCancelSubscription] Inserting", adminNotifs.length, "admin notifications");
      const { error: adminErr } = await (supabase as any).from("notifications").insert(adminNotifs);
      if (adminErr) console.error("[handleCancelSubscription] Admin notification insert error:", adminErr);
    }

    const playerNotif = {
      recipient_id: sub.player_id,
      recipient_role: "player",
      notification_type: "information",
      title: "Your plan has ended",
      message: `Your ${subsModalPlan.name} plan has been cancelled. Contact your coach or admin to renew or switch plans.`,
      is_read: false,
      data: { plan_id: sub.plan_id, plan_name: subsModalPlan.name },
    };
    await (supabase as any).from("notifications").insert(playerNotif);

    const { data: parentRels } = await (supabase as any)
      .from("parent_player_relationships")
      .select("parent_id")
      .eq("player_id", sub.player_id);
    const parentIds = (parentRels || []).map((r: { parent_id: string }) => r.parent_id);
    const playerFirstName = (sub.player_name || "").split(" ")[0] || "Your child";
    if (parentIds.length > 0) {
      const parentNotifs = parentIds.map((parentId: string) => ({
        recipient_id: parentId,
        recipient_role: "parent",
        notification_type: "information",
        title: `${playerFirstName}'s plan has ended`,
        message: `${sub.player_name}'s ${subsModalPlan.name} plan has been cancelled. Please contact your coach or admin to renew.`,
        is_read: false,
        data: { plan_id: sub.plan_id, plan_name: subsModalPlan.name, player_id: sub.player_id },
      }));
      await (supabase as any).from("notifications").insert(parentNotifs);
    }

    setCancellingSubId(null);
    showToast("Plan cancelled. Coaches, admins, player and parent notified.");
    setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
    fetchData();
  }

  /* ─── Discounts ─── */

  const fetchDiscounts = useCallback(async () => {
    setLoadingDiscounts(true);
    const { data } = await (supabase as any)
      .from("discounts")
      .select("id, name, amount, discount_type, duration_type, duration_months, description, program_type, is_active")
      .order("name");
    setDiscountsList(data || []);
    setLoadingDiscounts(false);
  }, [supabase]);

  useEffect(() => {
    if (tab === "discounts") fetchDiscounts();
  }, [tab, fetchDiscounts]);

  function resetDiscountForm() {
    setDiscountName("");
    setDiscountAmount("");
    setDiscountTypeField("flat");
    setDiscountDuration("forever");
    setDiscountDurationMonths("");
    setDiscountDescription("");
    setDiscountActive(true);
    setDiscountProgramType(null);
    setEditingDiscount(null);
  }

  function openCreateDiscount() {
    resetDiscountForm();
    const lastPlanTab = tab === "discounts" ? null : programTypeFilter;
    setDiscountProgramType(lastPlanTab);
    setShowDiscountModal(true);
  }

  function openEditDiscount(d: Discount) {
    setEditingDiscount(d);
    setDiscountName(d.name);
    setDiscountAmount(String(d.amount));
    setDiscountTypeField(d.discount_type);
    setDiscountDuration(d.duration_type);
    setDiscountDurationMonths(d.duration_months ? String(d.duration_months) : "");
    setDiscountDescription(d.description || "");
    setDiscountActive(d.is_active);
    setDiscountProgramType(d.program_type);
    setShowDiscountModal(true);
    setOpenDiscountMenu(null);
  }

  async function handleSaveDiscount() {
    if (!discountName.trim()) { showToast("Discount name is required"); return; }
    if (!discountAmount || parseFloat(discountAmount) <= 0) { showToast("Valid amount is required"); return; }

    setSavingDiscount(true);
    const payload = {
      name: discountName.trim(),
      amount: parseFloat(discountAmount),
      discount_type: discountTypeField,
      duration_type: discountDuration,
      duration_months: discountDuration === "repeating" ? parseInt(discountDurationMonths) || null : null,
      description: discountDescription.trim() || null,
      program_type: discountProgramType,
      is_active: discountActive,
    };

    let error;
    if (editingDiscount) {
      ({ error } = await (supabase as any).from("discounts").update(payload).eq("id", editingDiscount.id));
    } else {
      ({ error } = await (supabase as any).from("discounts").insert(payload));
    }

    setSavingDiscount(false);
    if (error) { showToast(editingDiscount ? "Failed to update discount" : "Failed to create discount"); return; }
    showToast(editingDiscount ? "Discount updated" : "Discount created");
    setShowDiscountModal(false);
    fetchDiscounts();
  }

  async function handleDeleteDiscount(d: Discount) {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    const { error } = await (supabase as any).from("discounts").delete().eq("id", d.id);
    if (error) { showToast("Failed to delete discount"); return; }
    showToast("Discount deleted");
    setOpenDiscountMenu(null);
    fetchDiscounts();
  }

  async function handleToggleDiscountActive(d: Discount) {
    await (supabase as any).from("discounts").update({ is_active: !d.is_active }).eq("id", d.id);
    showToast(d.is_active ? "Discount deactivated" : "Discount activated");
    setOpenDiscountMenu(null);
    fetchDiscounts();
  }

  function formatDuration(d: Discount): string {
    if (d.duration_type === "forever") return "∞";
    if (d.duration_type === "once") return "1x";
    return d.duration_months ? `${d.duration_months}mo` : "—";
  }

  function formatDiscountAmount(d: Discount): string {
    if (d.discount_type === "percentage") return `${d.amount}% Off`;
    return `$${d.amount} Off`;
  }

  /* ─── Allowance row helpers ─── */

  function updateAllowance(
    setter: React.Dispatch<React.SetStateAction<AllowanceMap>>,
    key: string,
    field: "qty" | "unlimited",
    value: string | boolean,
  ) {
    setter((prev) => {
      const entry = { ...prev[key] };
      if (field === "unlimited") {
        entry.unlimited = value as boolean;
        if (entry.unlimited) entry.qty = "";
      } else {
        entry.qty = value as string;
      }
      return { ...prev, [key]: entry };
    });
  }

  /* ─── Grouping ─── */

  const grouped = categories.map((cat) => ({
    category: cat,
    plans: plans.filter((p) => p.category_id === cat.id),
  }));
  const uncategorized = plans.filter((p) => !p.category_id);

  function billingLabel(period: string | null) {
    if (period === "monthly") return "/ month";
    if (period === "quarterly") return "/ quarter";
    if (period === "annual") return "/ year";
    return "";
  }

  /* ─── Reusable plan row renderer ─── */

  function pricingModelLabel(model: string | null): string {
    if (model === "per_player") return "Per Player";
    if (model === "flat_monthly") return "Flat";
    if (model === "per_feature") return "Per Feature";
    return "";
  }

  function renderPlanRow(plan: Plan) {
    const isB2b = plan.plan_recipient === "program";
    const summary = isB2b ? [] : buildSummary(plan);
    const planTypePill = !isB2b && plan.plan_type === "package" ? (
      <span className={`${styles.planTypeBadge} ${styles.badgePackage}`}>Package</span>
    ) : !isB2b && plan.plan_type === "bundle" ? (
      <span className={`${styles.planTypeBadge} ${styles.badgeBundle}`}>Bundle</span>
    ) : null;
    return (
      <div key={plan.id} className={styles.planRow}>
        <div className={styles.planInfo}>
          <span className={styles.planName}>{plan.name}</span>
          {planTypePill}
          {isB2b && (
            <span className={`${styles.planTypeBadge} ${styles.badgeB2b}`}>
              <Building2 size={14} /> Program
            </span>
          )}
          {isB2b && plan.pricing_model && (
            <span className={styles.pricingModelLabel}>{pricingModelLabel(plan.pricing_model)}</span>
          )}
        </div>
        <div className={styles.planMeta}>
          <span className={styles.planPrice}>
            ${plan.price?.toFixed(2)} {plan.plan_type === "recurring" && billingLabel(plan.billing_period)}
          </span>
          {summary.length > 0 && (
            <span className={styles.planAllowanceSummary}>
              {summary.join(" · ")}
            </span>
          )}
          <span className={styles.planSubs}>{plan.subscriber_count} active</span>
        </div>
        <div className={styles.planRowActions}>
          <button
            className={styles.starBtn}
            onClick={() => handleToggleFeatured(plan)}
            disabled={togglingFeatured === plan.id}
            title="Mark as Most Popular — players and parents will see this highlighted"
          >
            {plan.is_featured === true ? (
              <Star size={18} className={styles.starFilled} fill="url(#starGradient)" stroke="url(#starGradient)" />
            ) : (
              <Star size={18} className={styles.starOutline} />
            )}
          </button>
          <div className={styles.menuWrap}>
            <button className={styles.menuBtn} onClick={() => setOpenMenu(openMenu === `plan-${plan.id}` ? null : `plan-${plan.id}`)}>
              <MoreHorizontal size={16} />
            </button>
            {openMenu === `plan-${plan.id}` && (
              <div className={styles.menuDropdown}>
                <button className={styles.menuItem} onClick={() => openSubscribers(plan)}>Subscribers</button>
                <button className={styles.menuItem} onClick={() => openEditPlan(plan)}>Edit</button>
                <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleDeletePlan(plan)}>Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Reusable allowance row renderer ─── */

  function renderAllowanceRow(
    item: { key: string; label: string },
    map: AllowanceMap,
    setter: React.Dispatch<React.SetStateAction<AllowanceMap>>,
  ) {
    const entry = map[item.key] || { qty: "", unlimited: false };
    return (
      <div key={item.key} className={styles.allowanceRow}>
        <span className={styles.allowanceLabel}>{item.label}</span>
        <div className={styles.allowanceControls}>
          {!entry.unlimited && (
            <input
              type="number"
              min="0"
              className={styles.allowanceQty}
              value={entry.qty}
              onChange={(e) => updateAllowance(setter, item.key, "qty", e.target.value)}
              placeholder="0"
            />
          )}
          <button
            type="button"
            className={`${styles.unlimitedToggle} ${entry.unlimited ? styles.unlimitedActive : ""}`}
            onClick={() => updateAllowance(setter, item.key, "unlimited", !entry.unlimited)}
            title="Unlimited"
          >
            ∞
          </button>
        </div>
      </div>
    );
  }

  /* ─── Label with optional tooltip ─── */

  function renderLabel(text: string, tipKey?: string, required?: boolean) {
    return (
      <div className={styles.labelRow}>
        <label className={styles.label}>{text}{required && " *"}</label>
        {tipKey && TOOLTIPS[tipKey] && (
          <div className={styles.tipWrap}>
            <button type="button" className={styles.tipBtn} onClick={() => toggleTip(tipKey)}>
              <Info size={13} />
            </button>
            {visibleTip === tipKey && (
              <div className={styles.tipBox}>{TOOLTIPS[tipKey]}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className={styles.page}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-solid, #3b82f6)" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Plans</h1>
        <div className={styles.headerActions}>
          <button className={styles.btnGradient} onClick={() => { setCategoryName(""); setShowCategoryModal(true); }}>
            <Plus size={14} /> Category
          </button>
          <button className={styles.btnGradient} onClick={openCreatePlan}>
            <Plus size={14} /> Plan
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "champions" ? styles.tabActive : ""}`}
          onClick={() => setTab("champions")}
        >
          Champions Premier
        </button>
        <button
          className={`${styles.tab} ${tab === "homegrown" ? styles.tabActive : ""}`}
          onClick={() => setTab("homegrown")}
        >
          Homegrown
        </button>
        <button
          className={`${styles.tab} ${tab === "discounts" ? styles.tabActive : ""}`}
          onClick={() => setTab("discounts")}
        >
          Discounts
        </button>
      </div>

      {tab === "discounts" ? (
        <div className={styles.content}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className={styles.btnGradient} onClick={openCreateDiscount}>
              <Plus size={14} /> Discount
            </button>
          </div>

          {loadingDiscounts ? (
            <div className={styles.empty}>Loading...</div>
          ) : discountsList.length === 0 ? (
            <div className={styles.empty}>No discounts yet. Create one to get started.</div>
          ) : (
            <div className={styles.categorySection}>
              <table className={styles.discountTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Duration</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {discountsList.map((d) => (
                    <tr key={d.id}>
                      <td className={styles.discountName}>{d.name}</td>
                      <td>
                        <span className={`${styles.statusDot} ${d.is_active ? styles.statusDotActive : styles.statusDotInactive}`} />
                        {d.is_active ? "Active" : "Inactive"}
                      </td>
                      <td>Membership</td>
                      <td className={styles.discountAmountCell}>{formatDiscountAmount(d)}</td>
                      <td>{formatDuration(d)}</td>
                      <td>
                        <div className={styles.menuWrap}>
                          <button className={styles.menuBtn} onClick={() => setOpenDiscountMenu(openDiscountMenu === d.id ? null : d.id)}>
                            <MoreHorizontal size={16} />
                          </button>
                          {openDiscountMenu === d.id && (
                            <div className={styles.menuDropdown}>
                              <button className={styles.menuItem} onClick={() => openEditDiscount(d)}>Edit</button>
                              <button className={styles.menuItem} onClick={() => handleToggleDiscountActive(d)}>
                                {d.is_active ? "Deactivate" : "Activate"}
                              </button>
                              <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleDeleteDiscount(d)}>Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : plans.length === 0 && categories.length === 0 ? (
        <div className={styles.empty}>
          <p>No plans yet. Create a category to get started.</p>
        </div>
      ) : (
        <div className={styles.content}>
          {grouped.map(({ category: cat, plans: catPlans }) => (
            <div key={cat.id} className={styles.categorySection}>
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryName}>{cat.name}</h3>
                <div className={styles.menuWrap}>
                  <button className={styles.menuBtn} onClick={() => setOpenMenu(openMenu === `cat-${cat.id}` ? null : `cat-${cat.id}`)}>
                    <MoreHorizontal size={16} />
                  </button>
                  {openMenu === `cat-${cat.id}` && (
                    <div className={styles.menuDropdown}>
                      <button className={styles.menuItem} onClick={() => {
                        setEditingCategory(cat);
                        setEditCategoryName(cat.name);
                        setOpenMenu(null);
                      }}>
                        Edit
                      </button>
                      <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleDeleteCategory(cat)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {catPlans.length === 0 ? (
                <p className={styles.catEmpty}>No plans in this category</p>
              ) : (
                <div className={styles.planList}>
                  {catPlans.map(renderPlanRow)}
                </div>
              )}
            </div>
          ))}

          {uncategorized.length > 0 && (
            <div className={styles.categorySection}>
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryName}>Uncategorized</h3>
              </div>
              <div className={styles.planList}>
                {uncategorized.map(renderPlanRow)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Category Modal ─── */}
      {(showCategoryModal || editingCategory) && (
        <div className={styles.overlay} onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingCategory ? "Edit Category" : "New Category"}</h2>
              <button className={styles.modalClose} onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.label}>Category Name</label>
              <input
                className={styles.input}
                value={editingCategory ? editCategoryName : categoryName}
                onChange={(e) => editingCategory ? setEditCategoryName(e.target.value) : setCategoryName(e.target.value)}
                placeholder="e.g. Monthly Memberships"
                autoFocus
              />
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btnGradient}
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                disabled={savingCategory}
              >
                {savingCategory ? "Saving..." : editingCategory ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Plan Modal ─── */}
      {showPlanModal && (
        <div className={styles.overlay} onClick={() => setShowPlanModal(false)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingPlan ? "Edit Plan" : planStep === 1 ? "Choose Plan Type" : "Plan Details"}
              </h2>
              <button className={styles.modalClose} onClick={() => setShowPlanModal(false)}>
                <X size={18} />
              </button>
            </div>

            {planStep === 1 && !editingPlan && (
              <div className={styles.modalBody}>
                <div className={styles.typeCards}>
                  <button className={styles.typeCard} onClick={() => { setPlanType("recurring"); setPlanStep(2); }}>
                    <Repeat size={28} />
                    <span className={styles.typeCardTitle}>Recurring</span>
                    <span className={styles.typeCardDesc}>Monthly, quarterly, or annual subscription</span>
                  </button>
                  <button className={styles.typeCard} onClick={() => { setPlanType("package"); setPlanStep(2); }}>
                    <Package size={28} />
                    <span className={styles.typeCardTitle}>Package</span>
                    <span className={styles.typeCardDesc}>One-time bundle of sessions</span>
                  </button>
                </div>
              </div>
            )}

            {planStep === 2 && planType && (
              <>
                <div className={styles.modalBody}>
                  {/* ─── Recipient selector (Homegrown tab only) ─── */}
                  {tab === "homegrown" && !editingPlan && (
                    <div className={styles.recipientSelector}>
                      <button
                        type="button"
                        className={`${styles.recipientPill} ${planRecipient === "player" ? styles.recipientPillActive : ""}`}
                        onClick={() => setPlanRecipient("player")}
                      >
                        <Users size={14} /> Players &amp; Parents
                      </button>
                      <button
                        type="button"
                        className={`${styles.recipientPill} ${planRecipient === "program" ? styles.recipientPillActive : ""}`}
                        onClick={() => setPlanRecipient("program")}
                      >
                        <Building2 size={14} /> Program Admins
                      </button>
                    </div>
                  )}

                  {planRecipient === "program" && tab === "homegrown" ? (
                    /* ═══ B2B Program Admin form ═══ */
                    <>
                      <label className={styles.label}>Plan Name *</label>
                      <input className={styles.input} value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Pro Program License" />

                      <label className={styles.label}>Category</label>
                      <select className={styles.input} value={planCategoryId} onChange={(e) => setPlanCategoryId(e.target.value)}>
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      <label className={styles.label}>Short Description</label>
                      <textarea
                        className={styles.textarea}
                        value={planDescription}
                        onChange={(e) => setPlanDescription(e.target.value)}
                        placeholder="Brief description for admins..."
                      />

                      <label className={styles.label}>Pricing Model *</label>
                      <div className={styles.segmented}>
                        {([
                          { key: "per_player", label: "Per Player / Mo" },
                          { key: "flat_monthly", label: "Flat Monthly" },
                          { key: "per_feature", label: "Per Feature" },
                        ] as const).map((pm) => (
                          <button
                            key={pm.key}
                            type="button"
                            className={`${styles.segBtn} ${pricingModel === pm.key ? styles.segBtnActive : ""}`}
                            onClick={() => setPricingModel(pm.key)}
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>

                      {pricingModel === "per_feature" ? (
                        <>
                          <label className={styles.label}>Solo Access Fee</label>
                          <div className={styles.priceWrap}>
                            <span className={styles.pricePrefix}>$</span>
                            <input className={styles.priceInput} type="number" min="0" step="0.01" value={soloFee} onChange={(e) => setSoloFee(e.target.value)} placeholder="0.00" />
                            <span className={styles.priceSuffix}>/ month</span>
                          </div>
                          <label className={styles.label}>Virtual Access Fee</label>
                          <div className={styles.priceWrap}>
                            <span className={styles.pricePrefix}>$</span>
                            <input className={styles.priceInput} type="number" min="0" step="0.01" value={virtualFee} onChange={(e) => setVirtualFee(e.target.value)} placeholder="0.00" />
                            <span className={styles.priceSuffix}>/ month</span>
                          </div>
                          <label className={styles.label}>Base Price *</label>
                          <div className={styles.priceWrap}>
                            <span className={styles.pricePrefix}>$</span>
                            <input className={styles.priceInput} type="number" min="0" step="0.01" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="0.00" />
                            <span className={styles.priceSuffix}>/ month</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className={styles.label}>
                            {pricingModel === "per_player" ? "Price per player" : "Monthly fee"} *
                          </label>
                          <div className={styles.priceWrap}>
                            <span className={styles.pricePrefix}>$</span>
                            <input className={styles.priceInput} type="number" min="0" step="0.01" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="0.00" />
                            <span className={styles.priceSuffix}>/ month</span>
                          </div>
                        </>
                      )}

                      {pricingModel === "per_player" && (
                        <>
                          <label className={styles.label}>Max Players Included</label>
                          <input className={styles.input} type="number" min="0" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="Unlimited" />
                        </>
                      )}

                      {renderLabel("Billing Period", "billing_period", true)}
                      <div className={styles.segmented}>
                        {["monthly", "quarterly", "annual"].map((bp) => (
                          <button key={bp} type="button" className={`${styles.segBtn} ${planBillingPeriod === bp ? styles.segBtnActive : ""}`} onClick={() => setPlanBillingPeriod(bp)}>
                            {bp.charAt(0).toUpperCase() + bp.slice(1)}
                          </button>
                        ))}
                      </div>

                      {renderLabel("Minimum Commitment", "commitment")}
                      <select className={styles.input} value={planCommitment} onChange={(e) => setPlanCommitment(e.target.value)}>
                        {COMMITMENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      <div className={styles.allowanceSection}>
                        <h4 className={styles.allowanceSectionTitle}>Features Included</h4>

                        <div className={styles.b2bFeatureRow}>
                          <span className={styles.b2bFeatureLabel}>Solo Access</span>
                          <button type="button" className={`${styles.masterToggle} ${b2bSoloAccess ? styles.masterToggleOn : ""}`} onClick={() => setB2bSoloAccess(!b2bSoloAccess)}>
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>

                        <div className={styles.b2bFeatureRow}>
                          <span className={styles.b2bFeatureLabel}>Virtual 1:1 Sessions</span>
                          <button type="button" className={`${styles.masterToggle} ${b2bVirtual1on1 ? styles.masterToggleOn : ""}`} onClick={() => setB2bVirtual1on1(!b2bVirtual1on1)}>
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>
                        <span className={styles.b2bFeatureHint}>CPP, College Advising, Psychologist, Nutrition</span>

                        <div className={styles.b2bFeatureRow}>
                          <span className={styles.b2bFeatureLabel}>Group Virtual Sessions</span>
                          <button type="button" className={`${styles.masterToggle} ${b2bGroupVirtual ? styles.masterToggleOn : ""}`} onClick={() => setB2bGroupVirtual(!b2bGroupVirtual)}>
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>
                        <span className={styles.b2bFeatureHint}>Pro Player Stories, Group Film Analysis</span>

                        <div className={styles.b2bFeatureRow}>
                          <div className={styles.sectionTitleWithTip}>
                            <span className={styles.b2bFeatureLabel}>White-Label Branding</span>
                            <div className={styles.tipWrap}>
                              <button type="button" className={styles.tipBtn} onClick={() => toggleTip("white_label")}>
                                <Info size={13} />
                              </button>
                              {visibleTip === "white_label" && (
                                <div className={styles.tipBox}>Program gets custom logo and colors in the app</div>
                              )}
                            </div>
                          </div>
                          <button type="button" className={`${styles.masterToggle} ${b2bWhiteLabel ? styles.masterToggleOn : ""}`} onClick={() => setB2bWhiteLabel(!b2bWhiteLabel)}>
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* ═══ Player plan form (existing) ═══ */
                    <>
                      <label className={styles.label}>Plan Name *</label>
                      <input className={styles.input} value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Gold Membership" />

                      <label className={styles.label}>Category *</label>
                      <select className={styles.input} value={planCategoryId} onChange={(e) => setPlanCategoryId(e.target.value)}>
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      {renderLabel("Price", "price", true)}
                      <div className={styles.priceWrap}>
                        <span className={styles.pricePrefix}>$</span>
                        <input
                          className={styles.priceInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={planPrice}
                          onChange={(e) => setPlanPrice(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      {planType === "recurring" && (
                        <>
                          {renderLabel("Billing Period", "billing_period", true)}
                          <div className={styles.segmented}>
                            {["monthly", "quarterly", "annual"].map((bp) => (
                              <button
                                key={bp}
                                type="button"
                                className={`${styles.segBtn} ${planBillingPeriod === bp ? styles.segBtnActive : ""}`}
                                onClick={() => setPlanBillingPeriod(bp)}
                              >
                                {bp.charAt(0).toUpperCase() + bp.slice(1)}
                              </button>
                            ))}
                          </div>

                          {renderLabel("Minimum Commitment", "commitment")}
                          <select
                            className={styles.input}
                            value={planCommitment}
                            onChange={(e) => setPlanCommitment(e.target.value)}
                          >
                            {COMMITMENT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>

                          {tab !== "homegrown" ? (
                            <>
                              {renderLabel("Cancellation Fee", "cancellation_fee")}
                              <div className={styles.priceWrap}>
                                <span className={styles.pricePrefix}>$</span>
                                <input
                                  className={styles.priceInput}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={planCancellationFee}
                                  onChange={(e) => setPlanCancellationFee(e.target.value)}
                                  placeholder="No fee"
                                />
                              </div>
                              {planCancellationFee && parseFloat(planCancellationFee) > 0 && (
                                <>
                                  <label className={styles.label}>Cancellation Policy</label>
                                  <textarea
                                    className={styles.input}
                                    rows={2}
                                    value={planCancellationPolicy}
                                    onChange={(e) => setPlanCancellationPolicy(e.target.value)}
                                    placeholder="e.g. Early cancellation within 12-month commitment requires a $X fee."
                                  />
                                </>
                              )}
                            </>
                          ) : (
                            <p className={styles.homegrownFeeNote}>Online plans cannot include cancellation fees.</p>
                          )}
                        </>
                      )}

                      {tab !== "homegrown" && (
                        <div className={styles.allowanceSection}>
                          <h4 className={styles.allowanceSectionTitle}>On-field Sessions</h4>
                        {ONFIELD_TYPES.map((item) =>
                          renderAllowanceRow(item, onfieldAllowances, setOnfieldAllowances)
                        )}
                        </div>
                      )}

                      <div className={styles.allowanceSection}>
                        <div className={styles.allowanceSectionHeader}>
                          <div className={styles.sectionTitleWithTip}>
                            <h4 className={styles.allowanceSectionTitle}>Virtual Access</h4>
                            <div className={styles.tipWrap}>
                              <button type="button" className={styles.tipBtn} onClick={() => toggleTip("virtual")}>
                                <Info size={13} />
                              </button>
                              {visibleTip === "virtual" && (
                                <div className={styles.tipBox}>{TOOLTIPS.virtual}</div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`${styles.masterToggle} ${virtualAccess ? styles.masterToggleOn : ""}`}
                            onClick={() => setVirtualAccess(!virtualAccess)}
                          >
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>
                        {virtualAccess && (
                          <>
                            <p className={styles.allowanceSubhead}>1:1 Virtual</p>
                            {VIRTUAL_1ON1_TYPES.map((item) =>
                              renderAllowanceRow(item, virtualAllowances, setVirtualAllowances)
                            )}
                            <p className={styles.allowanceSubhead}>Group</p>
                            {VIRTUAL_GROUP_TYPES.map((item) =>
                              renderAllowanceRow(item, virtualAllowances, setVirtualAllowances)
                            )}
                          </>
                        )}
                      </div>

                      <div className={styles.allowanceSection}>
                        <div className={styles.allowanceSectionHeader}>
                          <div className={styles.sectionTitleWithTip}>
                            <h4 className={styles.allowanceSectionTitle}>Solo Page Access</h4>
                            <div className={styles.tipWrap}>
                              <button type="button" className={styles.tipBtn} onClick={() => toggleTip("solo")}>
                                <Info size={13} />
                              </button>
                              {visibleTip === "solo" && (
                                <div className={styles.tipBox}>{TOOLTIPS.solo}</div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`${styles.masterToggle} ${soloAccess ? styles.masterToggleOn : ""}`}
                            onClick={() => setSoloAccess(!soloAccess)}
                          >
                            <span className={styles.masterToggleThumb} />
                          </button>
                        </div>
                        {soloAccess && (
                          <>
                            {SOLO_TYPES.map((item) =>
                              renderAllowanceRow(item, soloAllowances, setSoloAllowances)
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.modalFooter}>
                  {!editingPlan && (
                    <button className={styles.btnGhost} onClick={() => { setPlanStep(1); setPlanType(null); setPlanRecipient("player"); }}>
                      Back
                    </button>
                  )}
                  <button className={styles.btnGradient} onClick={handleSavePlan} disabled={savingPlan}>
                    {savingPlan ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Subscribers Modal ─── */}
      {subsModalPlan && (
        <div className={styles.overlay} onClick={() => setSubsModalPlan(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Subscribers — {subsModalPlan.name}</h2>
              <button className={styles.modalClose} onClick={() => setSubsModalPlan(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {loadingSubs ? (
                <p className={styles.catEmpty}>Loading...</p>
              ) : subscriptions.length === 0 ? (
                <p className={styles.catEmpty}>No active subscribers</p>
              ) : (
                <div className={styles.subsList}>
                  {subscriptions.map((sub) => (
                    <div key={sub.id} className={styles.subsRow}>
                      <span className={styles.subsName}>{sub.player_name}</span>
                      <button
                        className={styles.btnDanger}
                        onClick={() => handleCancelSubscription(sub)}
                        disabled={cancellingSubId === sub.id}
                      >
                        {cancellingSubId === sub.id ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Discount Modal ─── */}
      {showDiscountModal && (
        <div className={styles.overlay} onClick={() => setShowDiscountModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingDiscount ? "Edit Discount" : "New Discount"}</h2>
              <button className={styles.modalClose} onClick={() => setShowDiscountModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                placeholder="e.g. Sibling Discount"
                autoFocus
              />

              <label className={styles.label}>Amount *</label>
              <div className={styles.priceWrap}>
                <span className={styles.pricePrefix}>{discountTypeField === "flat" ? "$" : "%"}</span>
                <input
                  className={styles.priceInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                />
              </div>

              <label className={styles.label}>Discount Type</label>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segBtn} ${discountTypeField === "flat" ? styles.segBtnActive : ""}`}
                  onClick={() => setDiscountTypeField("flat")}
                >
                  Flat ($)
                </button>
                <button
                  type="button"
                  className={`${styles.segBtn} ${discountTypeField === "percentage" ? styles.segBtnActive : ""}`}
                  onClick={() => setDiscountTypeField("percentage")}
                >
                  Percentage (%)
                </button>
              </div>

              <label className={styles.label}>Duration</label>
              <div className={styles.segmented}>
                {(["forever", "once", "repeating"] as const).map((dt) => (
                  <button
                    key={dt}
                    type="button"
                    className={`${styles.segBtn} ${discountDuration === dt ? styles.segBtnActive : ""}`}
                    onClick={() => setDiscountDuration(dt)}
                  >
                    {dt === "forever" ? "Forever" : dt === "once" ? "Once" : "Repeating"}
                  </button>
                ))}
              </div>
              {discountDuration === "repeating" && (
                <>
                  <label className={styles.label}>Duration (months)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    value={discountDurationMonths}
                    onChange={(e) => setDiscountDurationMonths(e.target.value)}
                    placeholder="e.g. 6"
                  />
                </>
              )}

              <label className={styles.label}>Description (optional)</label>
              <textarea
                className={styles.textarea}
                value={discountDescription}
                onChange={(e) => setDiscountDescription(e.target.value)}
                placeholder="Internal notes..."
              />

              <div className={styles.discountToggleRow}>
                <span className={styles.discountToggleLabel}>Active</span>
                <button
                  type="button"
                  className={`${styles.masterToggle} ${discountActive ? styles.masterToggleOn : ""}`}
                  onClick={() => setDiscountActive(!discountActive)}
                >
                  <span className={styles.masterToggleThumb} />
                </button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGradient} onClick={handleSaveDiscount} disabled={savingDiscount}>
                {savingDiscount ? "Saving..." : editingDiscount ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
