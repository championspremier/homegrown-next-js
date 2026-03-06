"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Check, ChevronDown, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProgramContactEmail, getProgramContactEmailByProgramId } from "@/app/actions/plan-gate";
import { acceptProgramOffer } from "@/app/actions/offer-spot";
import { usePlanAccess } from "./PlanAccessContext";
import styles from "./PlansModal.module.css";

const ONFIELD_FEATURES: { key: string; label: string }[] = [
  { key: "one_on_one", label: "1:1 Sessions" },
  { key: "tec_tac", label: "Tec Tac" },
  { key: "sprint_training", label: "Sprint Training" },
  { key: "strength_conditioning", label: "Strength & Conditioning" },
];

const VIRTUAL_FEATURES: { key: string; label: string }[] = [
  { key: "cpp", label: "CPP" },
  { key: "college_advising", label: "College Advising" },
  { key: "psychologist", label: "Psychologist" },
  { key: "nutrition", label: "Nutrition" },
  { key: "pro_player_stories", label: "Pro Player Stories" },
  { key: "group_film_analysis", label: "Group Film Analysis" },
];

const SOLO_FEATURES: { key: string; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "tactical", label: "Tactical" },
  { key: "physical", label: "Physical" },
  { key: "mental", label: "Mental" },
];

interface Plan {
  id: string;
  name: string;
  plan_type: string;
  price: number;
  billing_period: string | null;
  program_type: string | null;
  short_description: string | null;
  is_featured: boolean;
  session_allowances: {
    onfield?: Record<string, number>;
    virtual?: Record<string, number>;
    solo?: Record<string, number>;
  } | null;
  solo_access: boolean;
  virtual_access: boolean;
  cancellation_fee: number | null;
  cancellation_policy_text: string | null;
}

interface ProgramTab {
  id: string;
  name: string;
  logo_url: string | null;
  programType: string | null;
  contact_email: string | null;
}

function FeatureRow({ value, label }: { value: number; label: string }) {
  const included = value !== 0;
  const unlimited = value === -1;
  return (
    <div className={`${styles.featureRow} ${!included ? styles.featureRowExcluded : ""}`}>
      {included ? (
        <>
          <Check size={14} className={styles.featureCheck} />
          <span>{label}: {unlimited ? "∞" : value}</span>
        </>
      ) : (
        <>
          <X size={14} className={styles.featureX} />
          <span>{label}</span>
        </>
      )}
    </div>
  );
}

function CancellationRow({ fee, policyText, isHomegrown }: { fee: number | null; policyText: string | null; isHomegrown: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasFee = (fee ?? 0) > 0;
  if (hasFee) {
    return (
      <div className={styles.cancellationWrap}>
        <div className={styles.cancellationFeeRow}>
          <AlertTriangle size={12} className={styles.cancellationFeeIcon} />
          <span>Early cancellation fee: ${fee!.toFixed(2)}</span>
          {policyText && (
            <button type="button" className={styles.learnMoreLink} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide" : "Learn more"}
            </button>
          )}
        </div>
        {expanded && policyText && <p className={styles.cancellationPolicyText}>{policyText}</p>}
      </div>
    );
  }
  if (isHomegrown) {
    return (
      <div className={styles.cancelAnytimeRow}>
        <Check size={12} />
        <span>Cancel anytime, no fee</span>
      </div>
    );
  }
  return null;
}

interface PlansModalProps {
  onClose: () => void;
  currentPlanName?: string | null;
  offerId?: string | null;
  offeredPlanId?: string | null;
  programIdForContact?: string | null;
}

export default function PlansModal({
  onClose,
  currentPlanName,
  offerId,
  offeredPlanId,
  programIdForContact,
}: PlansModalProps) {
  const { profileId } = usePlanAccess();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [programTabs, setProgramTabs] = useState<ProgramTab[]>([]);
  const [homegrownProgram, setHomegrownProgram] = useState<{ id: string; name: string; logo_url: string | null; contact_email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("homegrown");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [expandedMobileCardId, setExpandedMobileCardId] = useState<string | null>(null);
  const [programTabsInfoOpen, setProgramTabsInfoOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: planData } = await (supabase as any)
        .from("plans")
        .select("id, name, plan_type, price, billing_period, program_type, short_description, is_featured, session_allowances, solo_access, virtual_access, cancellation_fee, cancellation_policy_text")
        .eq("plan_recipient", "player")
        .order("name");
      setPlans(planData || []);

      const { data: hg } = await (supabase as any)
        .from("programs")
        .select("id, name, logo_url, contact_email")
        .eq("slug", "homegrown")
        .maybeSingle();
      setHomegrownProgram(hg);

      let playerId = profileId;
      if (profileId) {
        const { data: rel } = await (supabase as any)
          .from("parent_player_relationships")
          .select("player_id")
          .eq("parent_id", profileId)
          .limit(1)
          .maybeSingle();
        if (rel?.player_id) playerId = rel.player_id;
      }
      if (playerId) {
        const tabs: ProgramTab[] = [];
        const seen = new Set<string>();

        if (hg) {
          tabs.push({
            id: hg.id,
            name: hg.name || "Homegrown",
            logo_url: hg.logo_url,
            programType: null,
            contact_email: hg.contact_email,
          });
          seen.add(hg.id);
        }

        const { data: memberships } = await (supabase as any)
          .from("program_memberships")
          .select("program_id, programs(id, name, logo_url, contact_email)")
          .eq("profile_id", playerId)
          .eq("is_active", true);
        for (const m of memberships || []) {
          const p = m.programs;
          if (!p || seen.has(p.id)) continue;
          seen.add(p.id);
          const programType = (planData || []).find((pl: Plan) => pl.program_type && pl.program_type === p.name)?.program_type ?? p.name;
          tabs.push({
            id: p.id,
            name: p.name || "Program",
            logo_url: p.logo_url,
            programType,
            contact_email: p.contact_email,
          });
        }

        const { data: activeSubs } = await (supabase as any)
          .from("plan_subscriptions")
          .select("plans(program_type)")
          .eq("player_id", playerId)
          .eq("status", "active");
        for (const sub of activeSubs || []) {
          const pt = sub.plans?.program_type;
          if (!pt || typeof pt !== "string" || pt.trim() === "") continue;
          const { data: prog } = await (supabase as any)
            .from("programs")
            .select("id, name, logo_url, contact_email")
            .eq("name", pt.trim())
            .maybeSingle();
          if (prog && !seen.has(prog.id)) {
            seen.add(prog.id);
            tabs.push({
              id: prog.id,
              name: prog.name || pt,
              logo_url: prog.logo_url,
              programType: pt,
              contact_email: prog.contact_email,
            });
          }
        }

        setProgramTabs(tabs);

        const currentPlan = (planData || []).find((p: Plan) => p.name === currentPlanName);
        const currentProgramType = currentPlan?.program_type;

        if (currentProgramType) {
          const match = tabs.find((t) => t.programType === currentProgramType);
          if (match) setActiveTab(match.id);
        } else if (currentPlan) {
          const match = tabs.find((t) => t.programType == null);
          if (match) setActiveTab(match.id);
        } else if (tabs.length > 0) {
          setActiveTab(tabs[0].id);
        }
      } else if (hg) {
        const tabs = [{ id: hg.id, name: hg.name || "Homegrown", logo_url: hg.logo_url, programType: null, contact_email: hg.contact_email }];
        setProgramTabs(tabs);
        setActiveTab(hg.id);
      }
      setLoading(false);
    })();
  }, [profileId, currentPlanName]);

  useEffect(() => {
    if (programIdForContact) {
      getProgramContactEmailByProgramId(programIdForContact).then(setContactEmail);
    } else if (profileId) {
      getProgramContactEmail(profileId).then(setContactEmail);
    }
  }, [profileId, programIdForContact]);

  const activeTabData = programTabs.find((t) => t.id === activeTab);
  const isHomegrownTab = activeTabData?.programType == null;

  const filteredPlans = plans.filter((p) => {
    const pType = p.program_type;
    const tabProgramType = activeTabData?.programType ?? null;
    if (pType !== tabProgramType) return false;
    if (isHomegrownTab && p.plan_type === "recurring") {
      return p.billing_period === billingPeriod;
    }
    return true;
  });

  function planTypePillLabel(plan: Plan): string {
    if (plan.plan_type === "recurring") {
      return plan.billing_period === "annual" ? "Annual" : "Monthly";
    }
    if (plan.plan_type === "package") return "One-time";
    if (plan.plan_type === "bundle") return "Bundle";
    return plan.plan_type === "recurring" ? (plan.billing_period === "annual" ? "Annual" : "Monthly") : "One-time";
  }

  function planTypeSubtext(plan: Plan): string | null {
    if (plan.plan_type === "package") return "Charged once, no subscription";
    if (plan.plan_type === "bundle") return "Session bundle, no subscription";
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Choose a Plan</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {programTabs.length > 0 && (
          <div className={styles.programTabsWrap}>
            <div className={styles.programTabs}>
              {programTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.programTab} ${activeTab === tab.id ? styles.programTabActive : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.logo_url ? (
                    <img src={tab.logo_url} alt="" className={styles.programTabLogo} />
                  ) : (
                    <div className={styles.programTabLogoFallback}>{tab.name.charAt(0)}</div>
                  )}
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
            <div className={styles.programTabsInfoWrap}>
              <button
                type="button"
                className={styles.programTabsInfoBtn}
                onClick={() => setProgramTabsInfoOpen(!programTabsInfoOpen)}
                aria-label="Program info"
              >
                <Info size={16} />
              </button>
              {programTabsInfoOpen && (
                <>
                  <div className={styles.programTabsInfoBackdrop} onClick={() => setProgramTabsInfoOpen(false)} />
                  <div className={styles.programTabsInfoPopover}>
                    <button type="button" className={styles.programTabsInfoClose} onClick={() => setProgramTabsInfoOpen(false)} aria-label="Close">
                      <X size={14} />
                    </button>
                    <p className={styles.programTabsInfoText}>
                      Champions Premier is our in-person training program. Homegrown is our virtual-only program. You can be enrolled in both simultaneously.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isHomegrownTab && (
          <div className={styles.billingToggle}>
            <button
              type="button"
              className={`${styles.billingToggleBtn} ${billingPeriod === "monthly" ? styles.billingToggleActive : ""}`}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`${styles.billingToggleBtn} ${billingPeriod === "annual" ? styles.billingToggleActive : ""}`}
              onClick={() => setBillingPeriod("annual")}
            >
              Annual
            </button>
          </div>
        )}

        {loading ? (
          <p className={styles.loading}>Loading plans...</p>
        ) : (
          <div className={styles.content}>
            <div className={styles.planGrid}>
              {filteredPlans.map((plan) => {
                const isCurrent = currentPlanName === plan.name;
                const isOffered = offeredPlanId === plan.id;
                const isFeatured = plan.is_featured === true;
                const isHomegrown = plan.program_type == null || plan.program_type === "";
                const showOnfield = !isHomegrown;
                const sa = plan.session_allowances;
                const onfield = sa?.onfield || {};
                const virtual = sa?.virtual || {};
                const solo = sa?.solo || {};

                const monthlyPlan = plans.find((p) => p.program_type === plan.program_type && p.billing_period === "monthly" && p.name !== plan.name);
                const monthlyEquivalent =
                  plan.plan_type === "recurring"
                    ? plan.billing_period === "annual"
                      ? plan.price / 12
                      : plan.billing_period === "quarterly"
                        ? plan.price / 3
                        : plan.price
                    : plan.price;
                const annualSavings =
                  plan.plan_type === "recurring" &&
                  plan.billing_period === "annual" &&
                  monthlyPlan
                    ? Math.round(monthlyPlan.price * 12 - plan.price)
                    : 0;

                const pricePrimary =
                  plan.plan_type === "recurring"
                    ? `$${monthlyEquivalent % 1 === 0 ? Math.round(monthlyEquivalent) : monthlyEquivalent.toFixed(1)} / mo`
                    : `$${plan.price} one-time`;
                const priceBilled =
                  plan.plan_type === "recurring" && plan.billing_period === "annual"
                    ? `Billed $${plan.price}/year`
                    : plan.plan_type === "recurring" && plan.billing_period === "quarterly"
                      ? `Billed $${plan.price}/quarter`
                      : null;
                const savingsLabel = annualSavings > 0 ? `Save $${annualSavings} vs monthly` : null;

                const mailto = activeTabData?.contact_email
                  ? `mailto:${activeTabData.contact_email}?subject=Plan%20inquiry%20-%20${encodeURIComponent(plan.name)}`
                  : contactEmail
                    ? `mailto:${contactEmail}?subject=Plan%20inquiry`
                    : "#";

                const typeSubtext = planTypeSubtext(plan);
                const isMobileExpanded = expandedMobileCardId === plan.id;
                const hasFee = (plan.cancellation_fee ?? 0) > 0;
                const cancellationOneLiner = hasFee
                  ? `Early cancellation fee: $${plan.cancellation_fee!.toFixed(2)}`
                  : isHomegrown
                    ? "Cancel anytime, no fee"
                    : null;

                return (
                  <div
                    key={plan.id}
                    className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ""} ${isOffered ? styles.planCardOffered : ""} ${isFeatured ? styles.planCardFeatured : ""} ${isMobileExpanded ? styles.planCardMobileExpanded : ""}`}
                  >
                    <div
                      className={styles.planCardMobileHeader}
                      onClick={() => setExpandedMobileCardId(isMobileExpanded ? null : plan.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setExpandedMobileCardId(isMobileExpanded ? null : plan.id)}
                    >
                      <div className={styles.planCardMobileRow1}>
                        <span className={styles.planCardMobileName}>{plan.name}</span>
                        <span className={styles.planPrice}>{pricePrimary}</span>
                        <ChevronDown size={20} className={`${styles.planCardMobileChevron} ${isMobileExpanded ? styles.planCardMobileChevronOpen : ""}`} />
                      </div>
                      <div className={styles.planCardMobileRow2}>
                        <span className={`${styles.planTypePill} ${styles.planTypePillMobile} ${plan.plan_type === "package" ? styles.planTypePillPackage : plan.plan_type === "bundle" ? styles.planTypePillBundle : styles.planTypePillRecurring}`}>
                          {planTypePillLabel(plan)}
                        </span>
                        {savingsLabel && <span className={styles.savingsBadgeMobile}>{savingsLabel}</span>}
                        {cancellationOneLiner && <span className={styles.planCardMobileCancel}>{cancellationOneLiner}</span>}
                        {isFeatured && <span className={styles.mostPopularBadgeMobile}>Most Popular</span>}
                        {isCurrent && <span className={styles.currentBadgeMobile}>Current Plan</span>}
                        {isOffered && <span className={styles.offerBadgeMobile}>Your Offer</span>}
                      </div>
                    </div>

                    {isFeatured && <span className={styles.mostPopularBadge}>Most Popular</span>}
                    {isCurrent && <span className={styles.currentBadge}>Current Plan</span>}
                    {isOffered && <span className={styles.offerBadge}>Your Offer</span>}

                    <div className={styles.planCardTop}>
                      <h3 className={styles.planName}>{plan.name}</h3>
                      <span className={`${styles.planTypePill} ${styles.planTypePillBelowName} ${plan.plan_type === "package" ? styles.planTypePillPackage : plan.plan_type === "bundle" ? styles.planTypePillBundle : styles.planTypePillRecurring}`}>
                        {planTypePillLabel(plan)}
                      </span>
                      <div className={styles.planPriceWrap}>
                        <span className={styles.planPrice}>{pricePrimary}</span>
                        {priceBilled && <span className={styles.planPriceBilled}>{priceBilled}</span>}
                      </div>
                      {savingsLabel && <span className={styles.savingsBadge}>{savingsLabel}</span>}
                      {typeSubtext && <p className={styles.planTypeSubtext}>{typeSubtext}</p>}
                      {plan.short_description && (
                        <p className={styles.planDesc}>{plan.short_description}</p>
                      )}
                    </div>

                    <div className={styles.planCardExpandable}>
                    <div className={styles.planFeatures}>
                      {showOnfield && plan.virtual_access && (
                        <>
                          <div className={styles.featureGroup}>On-field</div>
                          {ONFIELD_FEATURES.map((f) => (
                            <FeatureRow key={f.key} value={onfield[f.key] ?? 0} label={f.label} />
                          ))}
                        </>
                      )}
                      {(plan.virtual_access || Object.keys(virtual).some((k) => (virtual[k] ?? 0) > 0)) && (
                        <>
                          <div className={styles.featureGroup}>Virtual</div>
                          {VIRTUAL_FEATURES.map((f) => (
                            <FeatureRow key={f.key} value={virtual[f.key] ?? 0} label={f.label} />
                          ))}
                        </>
                      )}
                      {(plan.solo_access || Object.keys(solo).some((k) => (solo[k] ?? 0) > 0)) && (
                        <>
                          <div className={styles.featureGroup}>Solo</div>
                          {SOLO_FEATURES.map((f) => (
                            <FeatureRow key={f.key} value={solo[f.key] ?? 0} label={f.label} />
                          ))}
                        </>
                      )}
                    </div>

                    <div className={styles.planCardBottom}>
                      <CancellationRow
                        fee={plan.cancellation_fee}
                        policyText={plan.cancellation_policy_text}
                        isHomegrown={isHomegrown}
                      />
                      {isOffered && offerId ? (
                        <button
                          type="button"
                          className={styles.acceptOfferBtn}
                          disabled={acceptingOffer}
                          onClick={async () => {
                            setAcceptingOffer(true);
                            const result = await acceptProgramOffer(offerId);
                            setAcceptingOffer(false);
                            if (result.ok) {
                              if (contactEmail) window.location.href = `mailto:${contactEmail}?subject=Accepting%20my%20offer`;
                              alert("Contact your coach to complete enrollment.");
                              onClose();
                            } else {
                              alert(result.error || "Failed to accept offer");
                            }
                          }}
                        >
                          {acceptingOffer ? "Accepting..." : "Accept Offer"}
                        </button>
                      ) : (
                        <a
                          href={mailto}
                          className={styles.contactBtn}
                          onClick={(e) => !activeTabData?.contact_email && !contactEmail && e.preventDefault()}
                        >
                          Contact Coach
                        </a>
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredPlans.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyText}>No plans available for this selection.</p>
                <a
                  href={activeTabData?.contact_email ? `mailto:${activeTabData.contact_email}?subject=Plan%20inquiry` : contactEmail ? `mailto:${contactEmail}?subject=Plan%20inquiry` : "#"}
                  className={styles.getStartedBtn}
                >
                  Get Started
                </a>
              </div>
            )}
          </div>
        )}

        <p className={styles.footer}>Contact your coach or admin to change your plan.</p>
      </div>
    </div>
  );
}
