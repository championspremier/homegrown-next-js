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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import styles from "./profile.module.css";

interface Socials {
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
  linkedin: string | null;
}

interface ProfileClientProps {
  playerId: string;
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
  profile,
  photoUrl,
  homegrownProgram,
  onFieldProgram,
}: ProfileClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

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
