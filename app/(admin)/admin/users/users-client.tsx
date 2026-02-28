"use client";

import { useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateUserRole } from "@/app/actions/admin";
import {
  UserPen,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  UserPlus,
  Copy,
  Check,
  Save,
  Trash2,
} from "lucide-react";
import styles from "./users.module.css";

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

interface UsersClientProps {
  profiles: Profile[];
  memberships: Membership[];
  programs: ProgramOption[];
  relationships: Relationship[];
}

const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#6366f1"];
const ROLES = ["player", "parent", "coach", "admin"];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(p: Profile): string {
  const f = (p.first_name || "").charAt(0);
  const l = (p.last_name || "").charAt(0);
  if (f || l) return `${f}${l}`.toUpperCase();
  return (p.full_name || p.email || "?").charAt(0).toUpperCase();
}

function getAvatarColor(p: Profile): string {
  const seed = p.full_name || p.email || p.id;
  return AVATAR_COLORS[hashName(seed) % AVATAR_COLORS.length];
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

export function UsersClient({ profiles, memberships, programs, relationships }: UsersClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"staff" | "members" | "leads">("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

  const filteredProfiles = useMemo(() => {
    let list = profiles;

    if (activeTab === "staff") list = list.filter((p) => p.role === "coach" || p.role === "admin");
    else if (activeTab === "members") list = list.filter((p) => p.role === "player");
    else list = list.filter((p) => p.role === "parent");

    if (programFilter !== "all") {
      const profileIdsInProgram = new Set(memberships.filter((m) => m.program_id === programFilter).map((m) => m.profile_id));
      list = list.filter((p) => profileIdsInProgram.has(p.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.first_name || "").toLowerCase().includes(q) ||
        (p.last_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [profiles, memberships, activeTab, programFilter, searchQuery]);

  function toggleParent(id: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function getProgramPills(profileId: string) {
    const ms = membershipsByProfile[profileId] || [];
    return ms.filter((m) => m.programs).map((m) => m.programs!);
  }

  function handleCopyLink(slug: string, programName: string) {
    const link = `yourdomain.com/join/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(programName);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  return (
    <div className={styles.container}>
      {/* Tabs bar */}
      <div className={styles.tabsBar}>
        <div className={styles.tabs}>
          {([["members", "Members"], ["leads", "Leads"], ["staff", "Staff"]] as const).map(([key, label]) => (
            <button key={key} className={`${styles.tab} ${activeTab === key ? styles.tabActive : ""}`} onClick={() => setActiveTab(key)} type="button">
              {label}
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
          <button className={styles.addBtn} onClick={() => setAddPersonOpen(true)} type="button">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
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
            {activeTab === "members" && (
              <tr>
                <th>Name</th>
                <th>Programs</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Last Active</th>
                <th style={{ width: 50 }} />
              </tr>
            )}
            {activeTab === "leads" && (
              <tr>
                <th style={{ width: 36 }} />
                <th>Name</th>
                <th>Linked Players</th>
                <th>Programs</th>
                <th>Signed Up</th>
                <th style={{ width: 50 }} />
              </tr>
            )}
          </thead>
          <tbody>
            {filteredProfiles.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>No users found.</td>
              </tr>
            )}

            {/* Staff tab */}
            {activeTab === "staff" && filteredProfiles.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className={styles.nameCell}>
                    <div className={styles.avatar} style={{ background: getAvatarColor(p) }}>{getInitials(p)}</div>
                    <div className={styles.nameInfo}>
                      <span className={styles.nameText}>{getDisplayName(p)}</span>
                      <span className={styles.emailText}>{p.email || "—"}</span>
                    </div>
                  </div>
                </td>
                <td><span className={styles.roleBadge} data-role={roleBadgeAttr(p.role)}>{p.role}</span></td>
                <td>
                  <div className={styles.programPills}>
                    {getProgramPills(p.id).map((pg) => (
                      <span key={pg.id} className={styles.programPill} title={pg.name}>
                        {pg.logo_url ? <img src={pg.logo_url} alt={pg.name} className={styles.programLogo} /> : pg.name}
                      </span>
                    ))}
                    {getProgramPills(p.id).length === 0 && <span className={styles.noPlan}>—</span>}
                  </div>
                </td>
                <td className={styles.dateCell}>{formatDate(p.updated_at)}</td>
                <td><button className={styles.editBtn} onClick={() => setEditingUser(p)} type="button"><UserPen size={16} /></button></td>
              </tr>
            ))}

            {/* Members tab */}
            {activeTab === "members" && filteredProfiles.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className={styles.nameCell}>
                    <div className={styles.avatar} style={{ background: getAvatarColor(p) }}>{getInitials(p)}</div>
                    <div className={styles.nameInfo}>
                      <span className={styles.nameText}>{getDisplayName(p)}</span>
                      <span className={styles.emailText}>{p.email || "—"}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.programPills}>
                    {getProgramPills(p.id).map((pg) => (
                      <span key={pg.id} className={styles.programPill} title={pg.name}>
                        {pg.logo_url ? <img src={pg.logo_url} alt={pg.name} className={styles.programLogo} /> : pg.name}
                      </span>
                    ))}
                    {getProgramPills(p.id).length === 0 && <span className={styles.noPlan}>—</span>}
                  </div>
                </td>
                <td><span className={styles.noPlan}>No plan</span></td>
                <td><span className={styles.statusBadge} data-status="active">Active</span></td>
                <td className={styles.dateCell}>{formatDate(p.updated_at)}</td>
                <td><button className={styles.editBtn} onClick={() => setEditingUser(p)} type="button"><UserPen size={16} /></button></td>
              </tr>
            ))}

            {/* Leads tab */}
            {activeTab === "leads" && filteredProfiles.map((p) => {
              const children = childrenByParent[p.id] || [];
              const isExpanded = expandedParents.has(p.id);
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      {children.length > 0 ? (
                        <button className={styles.expandBtn} onClick={() => toggleParent(p.id)} type="button">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : <span style={{ width: 20, display: "inline-block" }} />}
                    </td>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar} style={{ background: getAvatarColor(p) }}>{getInitials(p)}</div>
                        <div className={styles.nameInfo}>
                          <span className={styles.nameText}>{getDisplayName(p)}</span>
                          <span className={styles.emailText}>{p.email || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={styles.linkedCount}>{children.length}</span></td>
                    <td>
                      <div className={styles.programPills}>
                        {getProgramPills(p.id).map((pg) => (
                          <span key={pg.id} className={styles.programPill} title={pg.name}>
                            {pg.logo_url ? <img src={pg.logo_url} alt={pg.name} className={styles.programLogo} /> : pg.name}
                          </span>
                        ))}
                        {getProgramPills(p.id).length === 0 && <span className={styles.noPlan}>—</span>}
                      </div>
                    </td>
                    <td className={styles.dateCell}>{formatDate(p.created_at)}</td>
                    <td><button className={styles.editBtn} onClick={() => setEditingUser(p)} type="button"><UserPen size={16} /></button></td>
                  </tr>
                  {isExpanded && children.map((childId) => {
                    const child = profilesById[childId];
                    if (!child) return null;
                    return (
                      <tr key={childId} className={styles.subRow}>
                        <td />
                        <td>
                          <div className={styles.subNameCell}>
                            <div className={styles.avatar} style={{ background: getAvatarColor(child), width: 28, height: 28, fontSize: "0.65rem" }}>{getInitials(child)}</div>
                            <div className={styles.nameInfo}>
                              <span className={styles.nameText}>{getDisplayName(child)}</span>
                              <span className={styles.emailText}>{child.email || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className={styles.roleBadge} data-role="player">player</span></td>
                        <td>
                          <div className={styles.programPills}>
                            {getProgramPills(childId).map((pg) => (
                              <span key={pg.id} className={styles.programPill} title={pg.name}>
                                {pg.logo_url ? <img src={pg.logo_url} alt={pg.name} className={styles.programLogo} /> : pg.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td />
                        <td><button className={styles.editBtn} onClick={() => setEditingUser(child)} type="button"><UserPen size={14} /></button></td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          membershipsByProfile={membershipsByProfile}
          programs={programs}
          childrenByParent={childrenByParent}
          parentsByPlayer={parentsByPlayer}
          profilesById={profilesById}
          onClose={() => setEditingUser(null)}
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

interface EditModalProps {
  user: Profile;
  membershipsByProfile: Record<string, Membership[]>;
  programs: ProgramOption[];
  childrenByParent: Record<string, string[]>;
  parentsByPlayer: Record<string, string[]>;
  profilesById: Record<string, Profile>;
  onClose: () => void;
}

function EditModal({ user, membershipsByProfile, programs, childrenByParent, parentsByPlayer, profilesById, onClose }: EditModalProps) {
  const router = useRouter();

  // Personal info
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

  // Role
  const [role, setRole] = useState(user.role || "player");
  const [savingRole, setSavingRole] = useState(false);

  // Memberships
  const userMemberships = membershipsByProfile[user.id] || [];
  const [localMemberships, setLocalMemberships] = useState(userMemberships);
  const [addProgramId, setAddProgramId] = useState("");
  const [addProgramRole, setAddProgramRole] = useState("player");

  // Link account
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

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

        {/* Section 1: Personal Information */}
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
            <button className={styles.saveBtn} onClick={handleSaveInfo} disabled={savingInfo} type="button">
              <Save size={14} /> {savingInfo ? "Saving..." : "Save"}
            </button>
            {infoMsg && <span className={styles.inlineMsg}>{infoMsg}</span>}
          </div>
        </div>

        {/* Section 2: Role & Programs */}
        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>Role &amp; Programs</h3>
          <div className={styles.roleRow}>
            <div className={styles.formField} style={{ flex: 1 }}>
              <span className={styles.formLabel}>Global Role</span>
              <select className={styles.formInput} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button className={styles.saveBtn} onClick={handleSaveRole} disabled={savingRole} type="button">
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
            <button className={styles.saveBtn} onClick={handleAddMembership} disabled={!addProgramId} type="button">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Section 3: Linked Accounts */}
        <div className={styles.modalSection}>
          <h3 className={styles.modalSectionTitle}>{linkedLabel}</h3>
          {linkedIds.length === 0 && <span className={styles.noPlan}>No linked accounts</span>}
          {linkedIds.map((id) => {
            const linked = profilesById[id];
            if (!linked) return null;
            return (
              <div key={id} className={styles.linkedAccount}>
                <div className={styles.linkedAccountInfo}>
                  <div className={styles.avatar} style={{ background: getAvatarColor(linked), width: 28, height: 28, fontSize: "0.65rem" }}>{getInitials(linked)}</div>
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
            <button className={styles.saveBtn} onClick={handleLinkAccount} disabled={linking || !linkEmail.trim()} type="button">
              <UserPlus size={14} /> {linking ? "Linking..." : "Link"}
            </button>
          </div>
          {linkMsg && <span className={styles.inlineMsg}>{linkMsg}</span>}
        </div>

        {/* Section 4: Quick Actions */}
        <div className={styles.modalSection}>
          <button className={styles.deactivateBtn} onClick={() => alert("Coming soon")} type="button">
            Deactivate Account
          </button>
        </div>
      </div>
    </div>
  );
}
