"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Save, Sun, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import styles from "@/app/components/staff-profile/staff-profile.module.css";

interface Props {
  adminId: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    address1: string;
    address2: string;
    postalCode: string;
    coachRole: string;
    teamLogos: string[];
  };
  photoUrl: string | null;
}

const COACH_ROLES = ["Coach", "Head Coach", "Current Pro", "Ex-Pro", "GK Current Pro", "GK Ex-Pro"];

export default function AdminProfileClient({ adminId, profile, photoUrl }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [originalEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [gender, setGender] = useState(profile.gender);
  const [address1, setAddress1] = useState(profile.address1);
  const [address2, setAddress2] = useState(profile.address2);
  const [postalCode, setPostalCode] = useState(profile.postalCode);
  const [coachRole, setCoachRole] = useState(profile.coachRole);
  const [teamLogos, setTeamLogos] = useState<string[]>(profile.teamLogos);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(photoUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "AD";

  useEffect(() => {
    const topbar = document.querySelector('[class*="layout_topbar"]') as HTMLElement;
    if (topbar) topbar.style.display = "none";
    return () => {
      if (topbar) topbar.style.display = "";
    };
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Photo must be under 5MB", "error");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      const { data: existing } = await supabase.storage
        .from("profile-photos")
        .list(`${adminId}/`, { limit: 100 });
      if (existing) {
        const avatarFiles = existing.filter((f) => f.name.toLowerCase().startsWith("avatar."));
        if (avatarFiles.length > 0) {
          await supabase.storage
            .from("profile-photos")
            .remove(avatarFiles.map((f) => `${adminId}/${f.name}`));
        }
      }

      const filePath = `${adminId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
      setCurrentPhotoUrl(`${urlData?.publicUrl}?t=${Date.now()}`);

      await supabase
        .from("profiles")
        .update({ profile_photo_url: urlData?.publicUrl || null })
        .eq("id", adminId);

      showToast("Photo uploaded!", "success");
      router.refresh();
    } catch (err: unknown) {
      showToast(`Upload failed: ${(err as Error).message}`, "error");
    } finally {
      setUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const supabase = createClient();
    const newLogos = [...teamLogos];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `${adminId}/logo-${Date.now()}-${i}.jpg`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (error) {
        console.error("Logo upload error:", error);
        continue;
      }
      const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
      if (urlData?.publicUrl) newLogos.push(urlData.publicUrl);
    }

    setTeamLogos(newLogos);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  function removeLogo(index: number) {
    setTeamLogos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage({ text: "First name and last name are required", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim() || null,
        gender: gender || null,
        address_1: address1.trim() || null,
        address_2: address2.trim() || null,
        postal_code: postalCode.trim() || null,
        coach_role: coachRole,
        team_logos: teamLogos,
      })
      .eq("id", adminId);

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
      setMessage({ text: "Profile saved! Confirmation email sent to verify the change.", type: "success" });
    } else {
      setMessage({ text: "Profile saved!", type: "success" });
    }

    setSaving(false);
    router.refresh();
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

  return (
    <div className={styles.container}>
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

      <div className={styles.mainLayout}>
        {/* Left: Form */}
        <div className={styles.formColumn}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Login Info</h3>
            <div className={styles.formRowSingle}>
              <label className={styles.formLabel}>
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} />
                {email !== originalEmail && <small className={styles.hint}>Confirmation email will be sent</small>}
              </label>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Personal Info</h3>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                <span>First Name</span>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} />
              </label>
              <label className={styles.formLabel}>
                <span>Last Name</span>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} />
              </label>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                <span>Address 1</span>
                <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className={styles.input} placeholder="Address 1" />
              </label>
              <label className={styles.formLabel}>
                <span>Address 2</span>
                <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className={styles.input} placeholder="Address 2" />
              </label>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                <span>Postal Code</span>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={styles.input} placeholder="90024" />
              </label>
              <label className={styles.formLabel}>
                <span>Phone</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={styles.input} />
              </label>
            </div>
            <div className={styles.formRowSingle}>
              <label className={styles.formLabel}>
                <span>Gender</span>
                <div className={styles.radioGroup}>
                  {(["female", "male", "not-specified"] as const).map((g) => (
                    <label key={g} className={styles.radioLabel}>
                      <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} />
                      <span>{g === "not-specified" ? "Not Specified" : g.charAt(0).toUpperCase() + g.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className={styles.sidebarColumn}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatarCircle}>
                {currentPhotoUrl && (
                  <img
                    src={currentPhotoUrl}
                    alt=""
                    className={styles.avatarImg}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <span className={styles.avatarInitials}>{initials}</span>
              </div>
              <button
                className={styles.avatarUploadBtn}
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading}
                type="button"
              >
                {uploading ? "…" : <Plus size={14} />}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
              />
            </div>
            <div className={styles.avatarName}>{firstName} {lastName}</div>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Coach Role</div>
            <select value={coachRole} onChange={(e) => setCoachRole(e.target.value)} className={styles.roleSelect}>
              {COACH_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Team Logos</div>
            <div className={styles.teamLogosGrid}>
              {teamLogos.map((logo, i) => (
                <div key={i} className={styles.teamLogoItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="" className={styles.teamLogoImg} />
                  <button className={styles.teamLogoRemove} onClick={() => removeLogo(i)} type="button">
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button className={styles.teamLogoAdd} onClick={() => logoInputRef.current?.click()} type="button">
                <Plus size={16} />
                <span>Add</span>
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleLogoUpload} />
            </div>
          </div>

          <button className={styles.saveBtn} onClick={handleSave} disabled={saving} type="button">
            <Save size={16} />
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
          {message && <div className={`${styles.formMessage} ${styles[message.type]}`}>{message.text}</div>}
        </div>
      </div>
    </div>
  );
}
