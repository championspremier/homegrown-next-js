"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Save,
  Upload,
  ImageIcon,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import styles from "./settings.module.css";

interface Program {
  id: string;
  name: string | null;
  slug: string | null;
  primary_color: string | null;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  address: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_tiktok: string | null;
  social_twitter: string | null;
  social_youtube: string | null;
  social_linkedin: string | null;
  lead_capture_url: string | null;
  calendly_org_url: string | null;
  cancellation_policy: string | null;
  refund_policy: string | null;
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
  plan_tier: string | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
}

interface Props {
  program: Program;
}

export default function SettingsClient({ program }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(program.name || "");
  const [slug, setSlug] = useState(program.slug || "");
  const [primaryColor, setPrimaryColor] = useState(program.primary_color || "#2563eb");
  const [logoUrl, setLogoUrl] = useState(program.logo_url || "");

  const [contactEmail, setContactEmail] = useState(program.contact_email || "");
  const [contactPhone, setContactPhone] = useState(program.contact_phone || "");
  const [websiteUrl, setWebsiteUrl] = useState(program.website_url || "");
  const [address, setAddress] = useState(program.address || "");

  const [socialFacebook, setSocialFacebook] = useState(program.social_facebook || "");
  const [socialInstagram, setSocialInstagram] = useState(program.social_instagram || "");
  const [socialTiktok, setSocialTiktok] = useState(program.social_tiktok || "");
  const [socialTwitter, setSocialTwitter] = useState(program.social_twitter || "");
  const [socialYoutube, setSocialYoutube] = useState(program.social_youtube || "");
  const [socialLinkedin, setSocialLinkedin] = useState(program.social_linkedin || "");

  const [leadCaptureUrl, setLeadCaptureUrl] = useState(program.lead_capture_url || "");
  const [calendlyOrgUrl, setCalendlyOrgUrl] = useState(program.calendly_org_url || "");

  const [cancellationPolicy, setCancellationPolicy] = useState(program.cancellation_policy || "");
  const [refundPolicy, setRefundPolicy] = useState(program.refund_policy || "");
  const [termsUrl, setTermsUrl] = useState(program.terms_of_service_url || "");
  const [privacyUrl, setPrivacyUrl] = useState(program.privacy_policy_url || "");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signupLinkCopied, setSignupLinkCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    contact: false,
    social: false,
    lead: false,
    policies: false,
    plan: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: "Logo must be under 5 MB", type: "error" });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${program.id}/logo.png`;

      const { data: existing } = await supabase.storage
        .from("program-logos")
        .list(program.id, { limit: 10 });
      if (existing && existing.length > 0) {
        await supabase.storage
          .from("program-logos")
          .remove(existing.map((f) => `${program.id}/${f.name}`));
      }

      const { error: uploadError } = await supabase.storage
        .from("program-logos")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("program-logos")
        .getPublicUrl(filePath);
      const newUrl = `${urlData?.publicUrl}?t=${Date.now()}`;
      setLogoUrl(newUrl);

      const { error: updateError } = await (supabase as any)
        .from("programs")
        .update({ logo_url: urlData?.publicUrl })
        .eq("id", program.id);
      if (updateError) throw updateError;

      setToast({ message: "Logo uploaded", type: "success" });
      router.refresh();
    } catch (err: unknown) {
      setToast({ message: `Upload failed: ${(err as Error).message}`, type: "error" });
    } finally {
      setUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("programs")
        .update({
          name: name || null,
          slug: slug || null,
          primary_color: primaryColor || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          website_url: websiteUrl || null,
          address: address || null,
          social_facebook: socialFacebook || null,
          social_instagram: socialInstagram || null,
          social_tiktok: socialTiktok || null,
          social_twitter: socialTwitter || null,
          social_youtube: socialYoutube || null,
          social_linkedin: socialLinkedin || null,
          lead_capture_url: leadCaptureUrl || null,
          calendly_org_url: calendlyOrgUrl || null,
          cancellation_policy: cancellationPolicy || null,
          refund_policy: refundPolicy || null,
          terms_of_service_url: termsUrl || null,
          privacy_policy_url: privacyUrl || null,
        })
        .eq("id", program.id);

      if (error) throw error;
      setToast({ message: "Settings saved", type: "success" });
      router.refresh();
    } catch (err: unknown) {
      setToast({ message: `Save failed: ${(err as Error).message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleCopyLink() {
    if (!leadCaptureUrl) return;
    navigator.clipboard.writeText(leadCaptureUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const planTier = (program.plan_tier || "free").toLowerCase();
  const planClass =
    planTier === "enterprise"
      ? styles.planEnterprise
      : planTier === "pro"
        ? styles.planPro
        : styles.planFree;

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  /* TikTok inline SVG since lucide-react has no TikTok icon */
  const TikTokIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.socialIcon}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
    </svg>
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Program Settings</h1>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          <Save size={16} />
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      <div className={styles.sections}>
        {/* Section 1: Program Logo */}
        <div className={styles.card}>
          <h2 className={styles.sectionHeading}>Program Logo</h2>
          <p className={styles.sectionDesc}>Upload your program&apos;s logo. Displayed in emails and player-facing pages.</p>
          <div className={styles.logoArea}>
            <div className={styles.logoPreview}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className={styles.logoImg} />
              ) : (
                <span className={styles.logoPlaceholder}>
                  <ImageIcon size={32} />
                </span>
              )}
            </div>
            <div className={styles.logoActions}>
              <button
                className={styles.uploadBtn}
                onClick={() => logoInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={14} />
                <span>{uploading ? "Uploading..." : "Upload Logo"}</span>
              </button>
              <span className={styles.uploadHint}>PNG or JPG, max 5 MB</span>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={handleLogoUpload}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Program Info */}
        <div className={styles.card}>
          <h2 className={styles.sectionHeading}>Program Info</h2>
          <p className={styles.sectionDesc}>Basic information about your program.</p>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.label}>Program Name</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Soccer Program"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Primary Color</span>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <span className={styles.colorValue}>{primaryColor}</span>
              </div>
            </label>
          </div>
          <div className={styles.fieldRowSingle}>
            <label className={styles.field}>
              <span className={styles.label}>Slug / Subdomain</span>
              <input
                className={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-program"
              />
              {slug && <span className={styles.slugPreview}>homegrown.app/{slug}</span>}
            </label>
          </div>
        </div>

        {/* Section 3: Contact Info (collapsible) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("contact")}>
            <div className={styles.cardHeaderLeft}>
              <h2 className={styles.sectionHeading}>Contact Info</h2>
              <p className={styles.sectionDesc}>How players and parents can reach your program.</p>
            </div>
            <ChevronDown size={20} className={`${styles.chevron} ${openSections.contact ? styles.chevronOpen : ""}`} />
          </div>
          {openSections.contact && (
            <div className={styles.cardBody}>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Email</span>
                  <input
                    type="email"
                    className={styles.input}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="info@yourprogram.com"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Phone</span>
                  <input
                    type="tel"
                    className={styles.input}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </label>
              </div>
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Website</span>
                  <input
                    type="url"
                    className={styles.input}
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yourprogram.com"
                  />
                </label>
              </div>
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Address</span>
                  <textarea
                    className={styles.textarea}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, State ZIP"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Social Media (collapsible) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("social")}>
            <div className={styles.cardHeaderLeft}>
              <h2 className={styles.sectionHeading}>Social Media</h2>
              <p className={styles.sectionDesc}>Link your social profiles so players can find you.</p>
            </div>
            <ChevronDown size={20} className={`${styles.chevron} ${openSections.social ? styles.chevronOpen : ""}`} />
          </div>
          {openSections.social && (
            <div className={styles.cardBody}>
              <div className={styles.socialRow}>
                <Facebook size={20} className={styles.socialIcon} />
                <input
                  className={styles.input}
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  placeholder="https://facebook.com/yourprogram"
                />
              </div>
              <div className={styles.socialRow}>
                <Instagram size={20} className={styles.socialIcon} />
                <input
                  className={styles.input}
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="https://instagram.com/yourprogram"
                />
              </div>
              <div className={styles.socialRow}>
                <TikTokIcon />
                <input
                  className={styles.input}
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="https://tiktok.com/@yourprogram"
                />
              </div>
              <div className={styles.socialRow}>
                <Twitter size={20} className={styles.socialIcon} />
                <input
                  className={styles.input}
                  value={socialTwitter}
                  onChange={(e) => setSocialTwitter(e.target.value)}
                  placeholder="https://x.com/yourprogram"
                />
              </div>
              <div className={styles.socialRow}>
                <Youtube size={20} className={styles.socialIcon} />
                <input
                  className={styles.input}
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  placeholder="https://youtube.com/@yourprogram"
                />
              </div>
              <div className={styles.socialRow}>
                <Linkedin size={20} className={styles.socialIcon} />
                <input
                  className={styles.input}
                  value={socialLinkedin}
                  onChange={(e) => setSocialLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/company/yourprogram"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Lead Capture (collapsible) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("lead")}>
            <div className={styles.cardHeaderLeft}>
              <h2 className={styles.sectionHeading}>Lead Capture</h2>
              <p className={styles.sectionDesc}>Landing page and scheduling links for new signups.</p>
            </div>
            <ChevronDown size={20} className={`${styles.chevron} ${openSections.lead ? styles.chevronOpen : ""}`} />
          </div>
          {openSections.lead && (
            <div className={styles.cardBody}>
              {slug && (
                <div className={styles.fieldRowSingle}>
                  <label className={styles.field}>
                    <span className={styles.label}>Player Signup Link</span>
                    <div className={styles.inputWithAction}>
                      <input
                        className={styles.input}
                        value={`yourdomain.com/join/${slug}`}
                        readOnly
                      />
                      <button
                        className={styles.copyBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(`yourdomain.com/join/${slug}`);
                          setSignupLinkCopied(true);
                          setTimeout(() => setSignupLinkCopied(false), 2000);
                        }}
                        type="button"
                      >
                        {signupLinkCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                      </button>
                    </div>
                    <span className={styles.slugPreview}>Share this link with players to sign up for your program</span>
                  </label>
                </div>
              )}
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Lead Capture URL</span>
                  <div className={styles.inputWithAction}>
                    <input
                      type="url"
                      className={styles.input}
                      value={leadCaptureUrl}
                      onChange={(e) => setLeadCaptureUrl(e.target.value)}
                      placeholder="https://yourprogram.com/signup"
                    />
                    <button className={styles.copyBtn} onClick={handleCopyLink} type="button">
                      {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                </label>
              </div>
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Calendly URL</span>
                  <input
                    type="url"
                    className={styles.input}
                    value={calendlyOrgUrl}
                    onChange={(e) => setCalendlyOrgUrl(e.target.value)}
                    placeholder="https://calendly.com/yourprogram"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Policies (collapsible) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("policies")}>
            <div className={styles.cardHeaderLeft}>
              <h2 className={styles.sectionHeading}>Policies</h2>
              <p className={styles.sectionDesc}>Legal and operational policies for your program.</p>
            </div>
            <ChevronDown size={20} className={`${styles.chevron} ${openSections.policies ? styles.chevronOpen : ""}`} />
          </div>
          {openSections.policies && (
            <div className={styles.cardBody}>
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Cancellation Policy</span>
                  <textarea
                    className={styles.textarea}
                    value={cancellationPolicy}
                    onChange={(e) => setCancellationPolicy(e.target.value)}
                    placeholder="Describe your cancellation policy..."
                  />
                </label>
              </div>
              <div className={styles.fieldRowSingle}>
                <label className={styles.field}>
                  <span className={styles.label}>Refund Policy</span>
                  <textarea
                    className={styles.textarea}
                    value={refundPolicy}
                    onChange={(e) => setRefundPolicy(e.target.value)}
                    placeholder="Describe your refund policy..."
                  />
                </label>
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.label}>Terms of Service URL</span>
                  <input
                    type="url"
                    className={styles.input}
                    value={termsUrl}
                    onChange={(e) => setTermsUrl(e.target.value)}
                    placeholder="https://yourprogram.com/terms"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Privacy Policy URL</span>
                  <input
                    type="url"
                    className={styles.input}
                    value={privacyUrl}
                    onChange={(e) => setPrivacyUrl(e.target.value)}
                    placeholder="https://yourprogram.com/privacy"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Section 7: Current Plan (collapsible) */}
        <div className={styles.card}>
          <div className={styles.cardHeader} onClick={() => toggleSection("plan")}>
            <div className={styles.cardHeaderLeft}>
              <h2 className={styles.sectionHeading}>Current Plan</h2>
              <p className={styles.sectionDesc}>Your subscription tier and billing details.</p>
            </div>
            <ChevronDown size={20} className={`${styles.chevron} ${openSections.plan ? styles.chevronOpen : ""}`} />
          </div>
          {openSections.plan && (
            <div className={styles.cardBody}>
              <div className={styles.planRow}>
                <span className={`${styles.planBadge} ${planClass}`}>{program.plan_tier || "Free"}</span>
                {(program.plan_started_at || program.plan_expires_at) && (
                  <span className={styles.planDates}>
                    {program.plan_started_at && <>Started {formatDate(program.plan_started_at)}</>}
                    {program.plan_started_at && program.plan_expires_at && " · "}
                    {program.plan_expires_at && <>Expires {formatDate(program.plan_expires_at)}</>}
                  </span>
                )}
                <button className={styles.upgradeBtn} disabled>
                  Upgrade Plan — Coming soon
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
