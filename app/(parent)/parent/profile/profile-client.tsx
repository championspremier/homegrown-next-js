"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Facebook,
  FileText,
  HelpCircle,
  Instagram,
  Linkedin,
  LogOut,
  Moon,
  Save,
  Share2,
  Sun,
  Twitter,
  User,
  UserPen,
  UserPlus,
  Users,
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

interface Props {
  parentId: string;
  parentProfile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  linkedPlayers: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    birthYear: number | null;
  }[];
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

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" style={{ flexShrink: 0 }}>
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
  </svg>
);

export default function ParentProfileClient({
  parentId,
  parentProfile,
  linkedPlayers,
  homegrownProgram,
  onFieldProgram,
}: Props) {
  const router = useRouter();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(parentProfile.firstName);
  const [lastName, setLastName] = useState(parentProfile.lastName);
  const [email, setEmail] = useState(parentProfile.email);
  const [originalEmail] = useState(parentProfile.email);
  const [phone, setPhone] = useState(parentProfile.phone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(true);
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

  async function handleSaveParent(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ text: "First name and last name are required", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim() || null,
      })
      .eq("id", parentId);

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: "error" });
      setSaving(false);
      return;
    }

    if (email !== originalEmail && email.trim() !== "") {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) {
        setMessage({ text: `Profile saved, but email change failed: ${emailError.message}`, type: "error" });
        setSaving(false);
        return;
      }
      setMessage({
        text: "Profile saved! A confirmation email has been sent to verify the change.",
        type: "success",
      });
    } else {
      setMessage({ text: "Profile updated!", type: "success" });
    }

    setSaving(false);
    router.refresh();
  }

  async function handleLinkPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!linkEmail.trim()) {
      showToast("Enter the player's email", "error");
      return;
    }

    setLinking(true);
    const supabase = createClient();

    const { data: playerProfile } = await (supabase as any)
      .from("profiles")
      .select("id, role")
      .eq("email", linkEmail.trim().toLowerCase())
      .eq("role", "player")
      .maybeSingle();

    if (!playerProfile) {
      showToast("No player account found with that email", "error");
      setLinking(false);
      return;
    }

    const { error: linkError } = await (supabase as any)
      .from("parent_player_relationships")
      .upsert(
        {
          parent_id: parentId,
          player_id: playerProfile.id,
        },
        { onConflict: "parent_id,player_id" }
      );

    setLinking(false);
    if (linkError) {
      showToast(`Failed to link: ${linkError.message}`, "error");
    } else {
      showToast("Player linked!", "success");
      setLinkEmail("");
      setShowAddPlayer(false);
      router.refresh();
    }
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

      {/* Edit Parent Account — collapsible, starts collapsed */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setEditOpen(!editOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <UserPen size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Edit Parent Account</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${editOpen ? styles.chevronOpen : ""}`} />
        </div>
        {editOpen && (
          <div className={styles.sectionBody}>
            <form onSubmit={handleSaveParent}>
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
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  <Save size={16} />
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
                {message && (
                  <div className={`${styles.formMessage} ${styles[message.type]}`}>{message.text}</div>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Linked Players — collapsible, starts open */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => setPlayersOpen(!playersOpen)}>
          <div className={styles.sectionHeaderLeft}>
            <Users size={20} className={styles.sectionIcon} />
            <h2 className={styles.sectionTitle}>Linked Players</h2>
          </div>
          <ChevronDown size={20} className={`${styles.chevron} ${playersOpen ? styles.chevronOpen : ""}`} />
        </div>
        {playersOpen && (
          <div className={styles.sectionBody}>
            {linkedPlayers.length > 0 && (
              <div className={styles.playersList}>
                {linkedPlayers.map((player) => (
                  <div key={player.id} className={styles.playerCard}>
                    <div className={styles.playerAvatar}>
                      <User size={24} />
                    </div>
                    <div className={styles.playerInfo}>
                      <div className={styles.playerName}>
                        {player.firstName} {player.lastName}
                      </div>
                      <div className={styles.playerMeta}>
                        {player.email}
                        {player.birthYear ? ` · ${player.birthYear}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {linkedPlayers.length === 0 && !showAddPlayer && (
              <p className={styles.emptyPlaceholder}>No players linked yet. Link a player account below.</p>
            )}

            <button
              className={styles.addPlayerToggle}
              onClick={(e) => {
                e.stopPropagation();
                setShowAddPlayer(!showAddPlayer);
              }}
              type="button"
            >
              <UserPlus size={20} />
              <span>Link Player Account</span>
              <ChevronDown size={18} className={`${styles.chevron} ${showAddPlayer ? styles.chevronOpen : ""}`} />
            </button>

            {showAddPlayer && (
              <form className={styles.addPlayerForm} onSubmit={handleLinkPlayer}>
                <p className={styles.sectionDesc}>Enter the email of an existing player account to link it.</p>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    <span>Player Email</span>
                    <input
                      type="email"
                      value={linkEmail}
                      onChange={(e) => setLinkEmail(e.target.value)}
                      placeholder="player@example.com"
                      required
                    />
                  </label>
                </div>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.btnPrimary} disabled={linking}>
                    <UserPlus size={16} />
                    <span>{linking ? "Linking..." : "Link Player"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Legal & Policies — collapsible, starts collapsed */}
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
                    !onFieldProgram.refundPolicy && (
                      <p className={styles.legalPlaceholder}>No policies available yet</p>
                    )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connect With Us — collapsible, starts collapsed */}
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

      {/* Support — collapsible, starts collapsed */}
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
