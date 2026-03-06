"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  Facebook,
  FileText,
  HelpCircle,
  Instagram,
  Linkedin,
  LogOut,
  Moon,
  Share2,
  Sun,
  Twitter,
  User,
  UserPen,
  Youtube,
  AlertTriangle,
  Check,
  MoreHorizontal,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import PlansModal from "@/components/plan-gate/PlansModal";
import { usePlanAccess } from "@/components/plan-gate/PlanAccessContext";
import styles from "./profile.module.css";

const SHORT_LABELS: Record<string, string> = {
  one_on_one: "1:1",
  tec_tac: "Tec Tac",
  sprint_training: "Sprint",
  strength_conditioning: "S&C",
  cpp: "CPP",
  college_advising: "College",
  psychologist: "Psych",
  nutrition: "Nutrition",
  pro_player_stories: "Stories",
  group_film_analysis: "Film",
  technical: "Technical",
  tactical: "Tactical",
  physical: "Physical",
  mental: "Mental",
};

interface Socials {
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
  linkedin: string | null;
}

interface ActivePlanData {
  id: string;
  plan_id: string;
  start_date: string | null;
  plans: {
    name: string | null;
    price: number;
    plan_type: string | null;
    billing_period: string | null;
    cancellation_fee: number | null;
    cancellation_policy_text: string | null;
    solo_access: boolean;
    virtual_access: boolean;
    session_allowances: Record<string, Record<string, number>> | null;
  } | null;
}

interface ProfileClientProps {
  playerId: string;
  effectivePlayerId: string;
  activePlans: ActivePlanData[];
  pastPlanName: string | null;
  playerName: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    birthDate: string | null;
    birthYear: number | null;
    gender: string;
    address1: string;
    address2: string;
    postalCode: string;
    teamName: string;
    competitiveLevel: string;
    positions: string[];
  };
  photoUrl: string | null;
  homegrownProgram: {
    termsUrl: string | null;
    privacyUrl: string | null;
    contactEmail: string | null;
    socials: Socials;
  };
  onFieldProgram: {
    name: string | null;
    cancellationPolicy: string | null;
    refundPolicy: string | null;
    termsUrl: string | null;
    privacyUrl: string | null;
    contactEmail: string | null;
    socials: Socials;
  } | null;
}

const POSITIONS = ["GK", "Central Defender", "Mid-Defensive", "Mid-Offensive", "Winger", "Full-Back", "Forward"];
const COMPETITIVE_LEVELS = ["MLS Next", "ECNL", "ECNL RL", "NCSL", "NAL", "EDP", "Other"];

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{ flexShrink: 0 }}>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
  </svg>
);

export default function ProfileClient({
  playerId,
  effectivePlayerId,
  activePlans,
  pastPlanName,
  playerName,
  profile,
  photoUrl,
  homegrownProgram,
  onFieldProgram,
}: ProfileClientProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const planAccess = usePlanAccess();
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [showCancelSurvey, setShowCancelSurvey] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelPlanTarget, setCancelPlanTarget] = useState<ActivePlanData | null>(null);
  const [cancelSurveyReason, setCancelSurveyReason] = useState<string>("");
  const [cancelSurveyFeedback, setCancelSurveyFeedback] = useState("");
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [detailsModalPlan, setDetailsModalPlan] = useState<ActivePlanData | null>(null);
  const [openMenuPlanId, setOpenMenuPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [originalEmail] = useState(profile.email);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber);
  const [birthDate, setBirthDate] = useState(profile.birthDate || "");
  const [gender, setGender] = useState(profile.gender);
  const [address1, setAddress1] = useState(profile.address1);
  const [address2, setAddress2] = useState(profile.address2);
  const [postalCode, setPostalCode] = useState(profile.postalCode);
  const [teamName, setTeamName] = useState(profile.teamName);
  const [competitiveLevel, setCompetitiveLevel] = useState(profile.competitiveLevel);
  const [positions, setPositions] = useState<string[]>(profile.positions);
  const [saving, setSaving] = useState(false);

  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    const topbar = document.querySelector('[class*="layout_topbar"]') as HTMLElement;
    if (topbar) topbar.style.display = "none";
    return () => {
      if (topbar) topbar.style.display = "";
    };
  }, []);

  function togglePosition(pos: string) {
    setPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast("First name and last name are required", "error");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim() || null,
        birth_date: birthDate || null,
        birth_year: birthDate ? new Date(birthDate).getFullYear() : profile.birthYear || null,
        gender: gender || null,
        address_1: address1.trim() || null,
        address_2: address2.trim() || null,
        postal_code: postalCode.trim() || null,
        team_name: teamName.trim() || null,
        competitive_level: competitiveLevel || null,
        positions: positions.length > 0 ? positions : null,
      })
      .eq("id", playerId);

    setSaving(false);
    if (error) {
      showToast(`Error: ${error.message}`, "error");
      return;
    }

    if (email !== originalEmail && email.trim() !== "") {
      const supabaseAuth = createClient();
      const { error: emailError } = await supabaseAuth.auth.updateUser({ email: email.trim() });
      if (emailError) {
        showToast(`Profile saved, but email change failed: ${emailError.message}`, "error");
        return;
      }
      showToast("Profile saved! Check your email to confirm the address change.", "success");
    } else {
      showToast("Profile updated!", "success");
    }

    router.refresh();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be less than 5MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCurrentPhotoUrl(ev.target?.result as string);
      setPhotoLoaded(true);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    const supabase = createClient();

    try {
      const { data: existing } = await supabase.storage
        .from("profile-photos")
        .list(`${playerId}/`, { limit: 100 });
      if (existing) {
        const avatarFiles = existing.filter((f) => f.name.toLowerCase().startsWith("avatar."));
        if (avatarFiles.length > 0) {
          await supabase.storage
            .from("profile-photos")
            .remove(avatarFiles.map((f) => `${playerId}/${f.name}`));
        }
      }
    } catch {
      // Continue even if cleanup fails
    }

    const { error } = await supabase.storage
      .from("profile-photos")
      .upload(`${playerId}/avatar.jpg`, file, { cacheControl: "3600", upsert: true });

    setUploading(false);

    if (error) {
      showToast(`Upload failed: ${error.message}`, "error");
    } else {
      const { data: pub } = supabase.storage.from("profile-photos").getPublicUrl(`${playerId}/avatar.jpg`);
      setCurrentPhotoUrl(`${pub.publicUrl}?t=${Date.now()}`);
      setPhotoLoaded(true);

      await (supabase as any)
        .from("profiles")
        .update({ profile_photo_url: pub.publicUrl || null })
        .eq("id", playerId);

      showToast("Photo uploaded!", "success");
      router.refresh();
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hg-theme") === "dark" ? "dark" : "light";
    }
    return "light";
  });

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("hg-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function buildUsageForPeriod(): string {
    const sa = planAccess.sessionAllowances;
    const su = planAccess.sessionUsage;
    if (!sa) return "";
    const parts: string[] = [];
    for (const [bucket, bucketMap] of Object.entries({ solo: sa.solo, virtual: sa.virtual })) {
      if (!bucketMap) continue;
      for (const [k, allowance] of Object.entries(bucketMap)) {
        if (allowance === 0) continue;
        const used = bucket === "solo" ? (su?.solo?.[k] ?? 0) : (su?.virtual?.[k] ?? 0);
        const label = SHORT_LABELS[k] || k.replace(/_/g, " ");
        if (allowance === -1) parts.push(`${label}: ${used}/∞`);
        else parts.push(`${label}: ${used}/${allowance}`);
      }
    }
    return parts.join(" · ");
  }

  function planTypeBadge(pt: string | null): string {
    if (pt === "recurring") return "Recurring";
    if (pt === "package") return "Package";
    if (pt === "bundle") return "Bundle";
    return "Recurring";
  }

  const CANCEL_REASONS = [
    "Too expensive",
    "Not enough time",
    "Achieved my goals",
    "Switching programs",
    "Taking a break",
    "Other",
  ] as const;

  async function handleSubmitCancelSurvey() {
    if (!cancelPlanTarget?.plans || !cancelSurveyReason.trim()) return;
    setSubmittingSurvey(true);
    const supabase = createClient();
    const { error: surveyError } = await (supabase as any)
      .from("cancellation_surveys")
      .insert({
        player_id: effectivePlayerId,
        plan_id: cancelPlanTarget.plan_id,
        subscription_id: cancelPlanTarget.id,
        primary_reason: cancelSurveyReason.trim(),
        additional_feedback: cancelSurveyFeedback.trim() || null,
      });
    if (surveyError) {
      setSubmittingSurvey(false);
      showToast("Failed to submit survey. Please try again.", "error");
      return;
    }
    const { data: admins } = await (supabase as any).from("profiles").select("id").eq("role", "admin");
    const adminIds = (admins || []).map((a: { id: string }) => a.id);
    if (adminIds.length > 0) {
      await (supabase as any).from("notifications").insert(
        adminIds.map((recipient_id: string) => ({
          recipient_id,
          recipient_role: "admin",
          notification_type: "information",
          title: "Cancellation Survey Submitted",
          message: `${playerName} is cancelling their ${cancelPlanTarget.plans.name} plan. Reason: ${cancelSurveyReason}.`,
          is_read: false,
          data: {
            player_id: effectivePlayerId,
            plan_id: cancelPlanTarget.plan_id,
            subscription_id: cancelPlanTarget.id,
            primary_reason: cancelSurveyReason,
            additional_feedback: cancelSurveyFeedback.trim() || null,
          },
        }))
      );
    }
    setSubmittingSurvey(false);
    setShowCancelSurvey(false);
    setCancelSurveyReason("");
    setCancelSurveyFeedback("");
    setCancelModalOpen(true);
  }

  function handleKeepPlanFromSurvey() {
    setShowCancelSurvey(false);
    setCancelPlanTarget(null);
    setCancelSurveyReason("");
    setCancelSurveyFeedback("");
  }

  async function handleCancelPlan() {
    if (!cancelPlanTarget) return;
    setCancelling(true);
    const supabase = createClient();
    await (supabase as any)
      .from("plan_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", cancelPlanTarget.id);

    const planName = cancelPlanTarget.plans?.name || "Plan";
    const { data: admins } = await (supabase as any).from("profiles").select("id").eq("role", "admin");
    const adminIds = (admins || []).map((a: { id: string }) => a.id);
    if (adminIds.length > 0) {
      await (supabase as any).from("notifications").insert(
        adminIds.map((recipient_id: string) => ({
          recipient_id,
          recipient_role: "admin",
          notification_type: "information",
          title: "Player cancelled plan",
          message: `${playerName} cancelled their ${planName} plan.`,
          is_read: false,
        }))
      );
    }
    setCancelling(false);
    setCancelModalOpen(false);
    setCancelPlanTarget(null);
    showToast("Your plan has been cancelled. You will lose access at the end of your billing period.", "success");
    router.refresh();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function renderSocialLinks(socials: Socials, label: string) {
    const links: { icon: React.ReactNode; name: string; url: string }[] = [];
    if (socials.facebook) links.push({ icon: <Facebook size={20} />, name: "Facebook", url: socials.facebook });
    if (socials.instagram) links.push({ icon: <Instagram size={20} />, name: "Instagram", url: socials.instagram });
    if (socials.tiktok) links.push({ icon: <TikTokIcon />, name: "TikTok", url: socials.tiktok });
    if (socials.twitter) links.push({ icon: <Twitter size={20} />, name: "X / Twitter", url: socials.twitter });
    if (socials.youtube) links.push({ icon: <Youtube size={20} />, name: "YouTube", url: socials.youtube });
    if (socials.linkedin) links.push({ icon: <Linkedin size={20} />, name: "LinkedIn", url: socials.linkedin });

    if (links.length === 0) return null;

    return (
      <>
        <span className={styles.socialGroupLabel}>{label}</span>
        {links.map((l) => (
          <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
            {l.icon}
            <span>{l.name}</span>
          </a>
        ))}
      </>
    );
  }

  const hgSocials = renderSocialLinks(homegrownProgram.socials, "Homegrown");
  const ofSocials = onFieldProgram ? renderSocialLinks(onFieldProgram.socials, onFieldProgram.name || "Your Program") : null;
  const hasSocials = hgSocials || ofSocials;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
        <div className={styles.actions}>
          <button className={styles.themeToggleBtn} onClick={toggleTheme} type="button" aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout} type="button">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* My Plan section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>My Plan</h2>
        {activePlans.length > 0 ? (
          <div className={styles.myPlanContent}>
            {activePlans.map((ap) => (
              ap.plans && (
                <div key={ap.id} className={styles.planCardMinimal}>
                  <div className={styles.planCardMinimalMain}>
                    <div className={styles.planCardMinimalHeader}>
                      <span className={styles.myPlanName}>{ap.plans.name}</span>
                      <span className={styles.myPlanActiveBadge}>Active</span>
                    </div>
                    <p className={styles.myPlanPrice}>
                      ${ap.plans.price} / {ap.plans.billing_period === "annual" ? "annual" : "monthly"}
                    </p>
                    {ap.start_date && (
                      <p className={styles.myPlanBilling}>Billing start: {new Date(ap.start_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className={styles.planCardMinimalActions}>
                    <button
                      type="button"
                      className={styles.planCardMoreBtn}
                      onClick={() => setOpenMenuPlanId(openMenuPlanId === ap.id ? null : ap.id)}
                      aria-label="More options"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openMenuPlanId === ap.id && (
                      <>
                        <div className={styles.planCardMenuBackdrop} onClick={() => setOpenMenuPlanId(null)} />
                        <div className={styles.planCardMenuDropdown}>
                          <button type="button" className={styles.planCardMenuItem} onClick={() => { setDetailsModalPlan(ap); setOpenMenuPlanId(null); }}>
                            View Details
                          </button>
                          <button type="button" className={`${styles.planCardMenuItem} ${styles.planCardMenuItemDanger}`} onClick={() => { setCancelPlanTarget(ap); setCancelSurveyReason(""); setCancelSurveyFeedback(""); setShowCancelSurvey(true); setOpenMenuPlanId(null); }}>
                            Cancel Plan
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            ))}
            <button type="button" className={styles.browsePlansLink} onClick={() => setPlansModalOpen(true)}>
              Browse Plans
            </button>
          </div>
        ) : (
          <div className={styles.myPlanContent}>
            <p className={styles.noPlanText}>No active plan</p>
            <button type="button" className={styles.viewPlansGradientBtn} onClick={() => setPlansModalOpen(true)}>
              View Plans
            </button>
            {pastPlanName && <p className={styles.pastPlanText}>Previous plan: {pastPlanName}</p>}
          </div>
        )}
      </div>

      {plansModalOpen && (
        <PlansModal
          onClose={() => setPlansModalOpen(false)}
          currentPlanName={activePlans[0]?.plans?.name ?? undefined}
          programIdForContact={undefined}
        />
      )}

      {showCancelSurvey && cancelPlanTarget?.plans && (
        <div className={styles.modalOverlay} onClick={handleKeepPlanFromSurvey}>
          <div className={styles.cancelSurveyModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.cancelSurveyTitle}>Before you go...</h3>
            <p className={styles.cancelSurveySubtext}>Help us improve by letting us know why you&apos;re cancelling.</p>
            <div className={styles.cancelSurveyQuestion}>
              <label className={styles.cancelSurveyLabel}>Primary reason (required)</label>
              <div className={styles.cancelSurveyPills}>
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.cancelSurveyPill} ${cancelSurveyReason === r ? styles.cancelSurveyPillActive : ""}`}
                    onClick={() => setCancelSurveyReason(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.cancelSurveyQuestion}>
              <label className={styles.cancelSurveyLabel}>Anything else you&apos;d like to share?</label>
              <textarea
                className={styles.cancelSurveyTextarea}
                value={cancelSurveyFeedback}
                onChange={(e) => setCancelSurveyFeedback(e.target.value.slice(0, 500))}
                placeholder="Your feedback helps us improve..."
                rows={3}
              />
              <span className={styles.cancelSurveyCharCount}>{cancelSurveyFeedback.length}/500</span>
            </div>
            <div className={styles.cancelSurveyActions}>
              <button
                type="button"
                className={styles.cancelSurveyContinueBtn}
                onClick={handleSubmitCancelSurvey}
                disabled={!cancelSurveyReason.trim() || submittingSurvey}
              >
                {submittingSurvey ? "Submitting..." : "Continue to Cancel"}
              </button>
              <button type="button" className={styles.keepPlanBtn} onClick={handleKeepPlanFromSurvey}>
                Keep My Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModalPlan?.plans && (
        <div className={styles.modalOverlay} onClick={() => setDetailsModalPlan(null)}>
          <div className={styles.detailsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailsModalHeader}>
              <h3 className={styles.detailsModalTitle}>{detailsModalPlan.plans.name}</h3>
              <span className={styles.myPlanActiveBadge}>Active</span>
            </div>
            <p className={styles.detailsModalPrice}>
              ${detailsModalPlan.plans.price} / {detailsModalPlan.plans.billing_period === "annual" ? "year" : detailsModalPlan.plans.billing_period || "month"}
            </p>
            <span className={`${styles.planTypeBadge} ${detailsModalPlan.plans.plan_type === "package" ? styles.planTypePackage : detailsModalPlan.plans.plan_type === "bundle" ? styles.planTypeBundle : styles.planTypeRecurring}`}>
              {planTypeBadge(detailsModalPlan.plans.plan_type)}
            </span>
            <div className={styles.detailsModalFeatures}>
              {(() => {
                const sa = detailsModalPlan.plans.session_allowances;
                const onfield = sa?.onfield || {};
                const virtual = sa?.virtual || {};
                const solo = sa?.solo || {};
                const showOnfield = detailsModalPlan.plans.virtual_access || Object.keys(onfield).some((k) => (onfield[k] ?? 0) > 0);
                return (
                  <>
                    {showOnfield && (
                      <>
                        <div className={styles.detailsFeatureGroup}>On-field</div>
                        {["one_on_one", "tec_tac", "sprint_training", "strength_conditioning"].map((k) => {
                          const v = onfield[k] ?? 0;
                          const label = SHORT_LABELS[k] || k.replace(/_/g, " ");
                          const inc = v !== 0;
                          const unlim = v === -1;
                          return (
                            <div key={k} className={`${styles.detailsFeatureRow} ${!inc ? styles.detailsFeatureExcluded : ""}`}>
                              {inc ? <Check size={14} className={styles.detailsFeatureCheck} /> : <X size={14} className={styles.detailsFeatureX} />}
                              <span>{label}: {inc ? (unlim ? "∞" : v) : "—"}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {(detailsModalPlan.plans.virtual_access || Object.keys(virtual).some((k) => (virtual[k] ?? 0) > 0)) && (
                      <>
                        <div className={styles.detailsFeatureGroup}>Virtual</div>
                        {["cpp", "college_advising", "psychologist", "nutrition", "pro_player_stories", "group_film_analysis"].map((k) => {
                          const v = virtual[k] ?? 0;
                          const label = SHORT_LABELS[k] || k.replace(/_/g, " ");
                          const inc = v !== 0;
                          const unlim = v === -1;
                          return (
                            <div key={k} className={`${styles.detailsFeatureRow} ${!inc ? styles.detailsFeatureExcluded : ""}`}>
                              {inc ? <Check size={14} className={styles.detailsFeatureCheck} /> : <X size={14} className={styles.detailsFeatureX} />}
                              <span>{label}: {inc ? (unlim ? "∞" : v) : "—"}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {(detailsModalPlan.plans.solo_access || Object.keys(solo).some((k) => (solo[k] ?? 0) > 0)) && (
                      <>
                        <div className={styles.detailsFeatureGroup}>Solo</div>
                        {["technical", "tactical", "physical", "mental"].map((k) => {
                          const v = solo[k] ?? 0;
                          const label = SHORT_LABELS[k] || k.replace(/_/g, " ");
                          const inc = v !== 0;
                          const unlim = v === -1;
                          return (
                            <div key={k} className={`${styles.detailsFeatureRow} ${!inc ? styles.detailsFeatureExcluded : ""}`}>
                              {inc ? <Check size={14} className={styles.detailsFeatureCheck} /> : <X size={14} className={styles.detailsFeatureX} />}
                              <span>{label}: {inc ? (unlim ? "∞" : v) : "—"}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <p className={styles.detailsModalUsage}>Usage this period: {buildUsageForPeriod() || "—"}</p>
            {detailsModalPlan.start_date && (
              <p className={styles.detailsModalBilling}>Billing start: {new Date(detailsModalPlan.start_date).toLocaleDateString()}</p>
            )}
            <div className={styles.detailsModalCancellation}>
              {(detailsModalPlan.plans.cancellation_fee ?? 0) > 0 ? (
                <div className={styles.detailsModalFeeRow}>
                  <AlertTriangle size={16} />
                  <span>Early cancellation fee: ${detailsModalPlan.plans.cancellation_fee!.toFixed(2)}</span>
                </div>
              ) : (
                <div className={styles.detailsModalCancelOk}>
                  <Check size={16} />
                  <span>Cancel anytime, no fee</span>
                </div>
              )}
            </div>
            <button type="button" className={styles.detailsModalCloseBtn} onClick={() => setDetailsModalPlan(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {cancelModalOpen && cancelPlanTarget?.plans && (
        <div className={styles.modalOverlay} onClick={() => { setCancelModalOpen(false); setCancelPlanTarget(null); }}>
          <div className={styles.cancelModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.cancelModalTitle}>Cancel Plan</h3>
            {(cancelPlanTarget.plans.cancellation_fee ?? 0) > 0 ? (
              <>
                <div className={styles.cancelModalWarning}>
                  <AlertTriangle size={18} />
                  <span>Early cancellation fee applies</span>
                </div>
                {cancelPlanTarget.plans.cancellation_policy_text && (
                  <p className={styles.cancelModalPolicy}>{cancelPlanTarget.plans.cancellation_policy_text}</p>
                )}
                <p className={styles.cancelModalFee}>A ${cancelPlanTarget.plans.cancellation_fee!.toFixed(2)} cancellation fee will be charged.</p>
              </>
            ) : (
              <p className={styles.cancelModalSimple}>
                Are you sure you want to cancel your {cancelPlanTarget.plans.name} plan?
              </p>
            )}
            <div className={styles.cancelModalActions}>
              <button type="button" className={styles.keepPlanBtn} onClick={() => { setCancelModalOpen(false); setCancelPlanTarget(null); }}>
                Keep My Plan
              </button>
              <button
                type="button"
                className={styles.cancelAnywayBtn}
                onClick={handleCancelPlan}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : (cancelPlanTarget.plans.cancellation_fee ?? 0) > 0 ? "Cancel Anyway" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Photo — always visible */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile Photo</h2>
        <div className={styles.photoUpload}>
          <div className={styles.photoPreview}>
            {currentPhotoUrl && photoLoaded ? (
              <img src={currentPhotoUrl} alt="Profile" className={styles.photoImg} onError={() => setPhotoLoaded(false)} />
            ) : currentPhotoUrl && !photoLoaded ? (
              <>
                <img
                  src={currentPhotoUrl}
                  alt="Profile"
                  className={styles.photoImg}
                  onLoad={() => setPhotoLoaded(true)}
                  onError={() => setPhotoLoaded(false)}
                  style={{ display: "none" }}
                />
                <div className={styles.photoPlaceholder}>
                  <User size={60} strokeWidth={1} />
                </div>
              </>
            ) : (
              <div className={styles.photoPlaceholder}>
                <User size={60} strokeWidth={1} />
              </div>
            )}
          </div>
          <button
            className={styles.photoEditBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            type="button"
          >
            <Camera size={18} />
            <span>{uploading ? "Uploading..." : "Edit Photo"}</span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
        </div>
      </div>

      {/* Edit Player Account — collapsible */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setEditOpen(!editOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <UserPen size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Edit Player Account</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${editOpen ? styles.chevronOpen : ""}`} />
        </div>
        {editOpen && (
          <div className={styles.sectionBody}>
            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>First Name</span>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </label>
                <label className={styles.formLabel}>
                  <span>Last Name</span>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {email !== originalEmail && (
                    <small className={styles.formHint}>A confirmation email will be sent to verify the change</small>
                  )}
                </label>
                <label className={styles.formLabel}>
                  <span>Phone Number</span>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>Birth Date</span>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    min={`${new Date().getFullYear() - 25}-01-01`}
                  />
                </label>
                <div className={styles.formLabel}>
                  <span>Gender</span>
                  <div className={styles.radioGroup}>
                    {(["female", "male", "not-specified"] as const).map((g) => (
                      <label key={g} className={styles.radioLabel}>
                        <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} />
                        <span>{g === "not-specified" ? "Not Specified" : g.charAt(0).toUpperCase() + g.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>Address 1</span>
                  <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="Street address" />
                </label>
                <label className={styles.formLabel}>
                  <span>Address 2</span>
                  <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="Apt, suite, etc." />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>Postal Code</span>
                  <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="90024" />
                </label>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  <span>Team / Club Name</span>
                  <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="NVA, DCU, etc." />
                </label>
                <label className={styles.formLabel}>
                  <span>Competitive Level</span>
                  <select
                    value={competitiveLevel}
                    onChange={(e) => setCompetitiveLevel(e.target.value)}
                    className={styles.selectField}
                  >
                    <option value="">Select level</option>
                    {COMPETITIVE_LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.formLabel}>
                <span>Positions</span>
                <div className={styles.positionsRow}>
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      className={`${styles.positionPill} ${positions.includes(pos) ? styles.positionPillActive : ""}`}
                      onClick={() => togglePosition(pos)}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Legal & Policies — collapsible */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setLegalOpen(!legalOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <FileText size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Legal &amp; Policies</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${legalOpen ? styles.chevronOpen : ""}`} />
        </div>
        {legalOpen && (
          <div className={styles.sectionBody}>
            <div className={styles.legalLinks}>
              <h3 className={styles.legalGroupTitle}>Homegrown</h3>
              {homegrownProgram.termsUrl && (
                <a href={homegrownProgram.termsUrl} target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                  Terms &amp; Conditions ↗
                </a>
              )}
              {homegrownProgram.privacyUrl && (
                <a href={homegrownProgram.privacyUrl} target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                  Privacy Policy ↗
                </a>
              )}
              {!homegrownProgram.termsUrl && !homegrownProgram.privacyUrl && (
                <p className={styles.legalPlaceholder}>Coming soon</p>
              )}

              {onFieldProgram && (
                <>
                  <h3 className={styles.legalGroupTitle}>{onFieldProgram.name || "Your Program"}</h3>
                  {onFieldProgram.termsUrl && (
                    <a href={onFieldProgram.termsUrl} target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                      Terms &amp; Conditions ↗
                    </a>
                  )}
                  {onFieldProgram.privacyUrl && (
                    <a href={onFieldProgram.privacyUrl} target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                      Privacy Policy ↗
                    </a>
                  )}
                  {onFieldProgram.cancellationPolicy && (
                    <div className={styles.policyBlock}>
                      <span className={styles.policyLabel}>Cancellation Policy</span>
                      <p className={styles.policyText}>{onFieldProgram.cancellationPolicy}</p>
                    </div>
                  )}
                  {onFieldProgram.refundPolicy && (
                    <div className={styles.policyBlock}>
                      <span className={styles.policyLabel}>Refund Policy</span>
                      <p className={styles.policyText}>{onFieldProgram.refundPolicy}</p>
                    </div>
                  )}
                  {!onFieldProgram.termsUrl &&
                    !onFieldProgram.privacyUrl &&
                    !onFieldProgram.cancellationPolicy &&
                    !onFieldProgram.refundPolicy && <p className={styles.legalPlaceholder}>No policies available yet</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connect With Us — collapsible */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setSocialOpen(!socialOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <Share2 size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Connect With Us</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${socialOpen ? styles.chevronOpen : ""}`} />
        </div>
        {socialOpen && (
          <div className={styles.sectionBody}>
            <div className={styles.socialLinks}>
              {hasSocials ? (
                <>
                  {hgSocials}
                  {ofSocials}
                </>
              ) : (
                <p className={styles.socialPlaceholder}>Coming soon</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Support — collapsible */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setSupportOpen(!supportOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <HelpCircle size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Support</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${supportOpen ? styles.chevronOpen : ""}`} />
        </div>
        {supportOpen && (
          <div className={styles.sectionBody}>
            <a
              href={`mailto:${onFieldProgram?.contactEmail || homegrownProgram.contactEmail || "support@homegrown.app"}`}
              className={styles.supportLink}
            >
              Report an Issue
            </a>
            <a href="#" className={styles.supportLink} onClick={(e) => e.preventDefault()}>
              FAQ — Coming soon
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
