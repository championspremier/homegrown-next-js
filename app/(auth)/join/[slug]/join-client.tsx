"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Mail, Lock, Calendar, Check } from "lucide-react";
import styles from "./join.module.css";

interface JoinClientProps {
  program: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  homegrownProgramId: string | null;
}

type SignupType = "player" | "parent-player" | "coach";
type ParentPlayerStep = 1 | 2;

export default function JoinClient({ program, homegrownProgramId }: JoinClientProps) {
  const [signupType, setSignupType] = useState<SignupType>("player");
  const [parentPlayerStep, setParentPlayerStep] = useState<ParentPlayerStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player fields
  const [playerFirstName, setPlayerFirstName] = useState("");
  const [playerLastName, setPlayerLastName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerPassword, setPlayerPassword] = useState("");
  const [playerBirthDate, setPlayerBirthDate] = useState("");

  // Parent fields
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");

  // Coach fields
  const [coachFirstName, setCoachFirstName] = useState("");
  const [coachLastName, setCoachLastName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachPassword, setCoachPassword] = useState("");

  const accentColor = program.primaryColor || undefined;

  async function insertMemberships(
    supabase: ReturnType<typeof createClient>,
    profileId: string,
    programRole: string
  ) {
    const memberships: Record<string, unknown>[] = [
      { id: crypto.randomUUID(), program_id: program.id, profile_id: profileId, program_role: programRole, is_active: true },
    ];
    if (homegrownProgramId) {
      memberships.push({
        id: crypto.randomUUID(),
        program_id: homegrownProgramId,
        profile_id: profileId,
        program_role: programRole,
        is_active: true,
      });
    }
    const { error: memError } = await (supabase as any).from("program_memberships").insert(memberships);
    if (memError) console.error("Membership insert failed:", memError);
  }

  async function handlePlayerSignup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (!playerFirstName || !playerLastName || !playerEmail || !playerPassword) {
        throw new Error("Please complete all required fields.");
      }
      if (playerPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const fullName = `${playerFirstName} ${playerLastName}`.trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: playerEmail,
        password: playerPassword,
        options: {
          data: { role: "player", full_name: fullName, first_name: playerFirstName, last_name: playerLastName },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("This email is already in use. Try logging in instead.");
        }
        throw authError;
      }
      if (!authData.user) throw new Error("User creation failed");

      await new Promise((r) => setTimeout(r, 1000));

      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: fullName,
          first_name: playerFirstName,
          last_name: playerLastName,
          birth_date: playerBirthDate || null,
          default_program_id: program.id,
        })
        .eq("id", authData.user.id);

      if (updateError) console.error("Player profile update failed:", updateError);

      await insertMemberships(supabase, authData.user.id, "player");

      // Sign out and sign back in for proper session establishment
      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: playerEmail,
        password: playerPassword,
      });
      if (signInError) console.error("Player sign-in after signup failed:", signInError);

      await new Promise((r) => setTimeout(r, 500));
      window.location.href = "/api/active-profile/reset";
    } catch (err: unknown) {
      setError((err as Error).message || "Signup failed");
      setLoading(false);
    }
  }

  async function handleParentPlayerSignup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const parentFullName = `${parentFirstName} ${parentLastName}`.trim();
      const playerFullName = `${playerFirstName} ${playerLastName}`.trim();

      // Step 1: Create parent account
      const { data: parentAuthData, error: parentAuthError } = await supabase.auth.signUp({
        email: parentEmail,
        password: parentPassword,
        options: {
          data: { role: "parent", full_name: parentFullName, first_name: parentFirstName, last_name: parentLastName },
        },
      });

      if (parentAuthError) {
        if (parentAuthError.message.includes("already registered")) {
          throw new Error("Parent email is already in use. Try logging in instead.");
        }
        throw new Error(`Parent account: ${parentAuthError.message}`);
      }
      if (!parentAuthData.user) throw new Error("Parent user creation failed");

      const parentId = parentAuthData.user.id;
      await new Promise((r) => setTimeout(r, 1000));

      const { error: parentUpdateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: parentFullName,
          first_name: parentFirstName,
          last_name: parentLastName,
          default_program_id: program.id,
        })
        .eq("id", parentId);

      if (parentUpdateError) console.error("Parent profile update failed:", parentUpdateError);

      await insertMemberships(supabase, parentId, "parent");

      // Store parent session tokens before signing out
      const {
        data: { session: parentSession },
      } = await supabase.auth.getSession();
      const parentAccessToken = parentSession?.access_token;
      const parentRefreshToken = parentSession?.refresh_token;

      // Step 2: Sign out parent, create player account
      await supabase.auth.signOut();

      const { data: playerAuthData, error: playerAuthError } = await supabase.auth.signUp({
        email: playerEmail,
        password: playerPassword,
        options: {
          data: { role: "player", full_name: playerFullName, first_name: playerFirstName, last_name: playerLastName },
        },
      });

      if (playerAuthError) {
        if (playerAuthError.message.includes("already registered")) {
          throw new Error("Player email is already in use. Try logging in instead.");
        }
        throw new Error(`Player account: ${playerAuthError.message}`);
      }
      if (!playerAuthData.user) throw new Error("Player user creation failed");

      const playerId = playerAuthData.user.id;
      await new Promise((r) => setTimeout(r, 1000));

      const { error: playerUpdateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: playerFullName,
          first_name: playerFirstName,
          last_name: playerLastName,
          birth_date: playerBirthDate || null,
          default_program_id: program.id,
        })
        .eq("id", playerId);

      if (playerUpdateError) console.error("Player profile update failed:", playerUpdateError);

      await insertMemberships(supabase, playerId, "player");

      // Step 3: Restore parent session to create relationship
      await supabase.auth.signOut();

      let restoredAsParent = false;
      if (parentAccessToken && parentRefreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: parentAccessToken,
          refresh_token: parentRefreshToken,
        });
        if (!setSessionError) restoredAsParent = true;
        else console.error("setSession failed:", setSessionError);
      }

      if (!restoredAsParent) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parentEmail,
          password: parentPassword,
        });
        if (signInError) {
          console.error("Parent sign-in fallback failed:", signInError);
          throw new Error("Could not sign back in as parent to link accounts");
        }
      }

      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Create parent-player relationship
      const { error: relationshipError } = await (supabase as any)
        .from("parent_player_relationships")
        .insert({ parent_id: parentId, player_id: playerId });

      if (relationshipError) console.error("Failed to create parent-player relationship:", relationshipError);

      window.location.assign("/api/active-profile/reset");
    } catch (err: unknown) {
      setError((err as Error).message || "Signup failed");
      setLoading(false);
    }
  }

  async function handleCoachSignup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      if (!coachFirstName || !coachLastName || !coachEmail || !coachPassword) {
        throw new Error("Please complete all required fields.");
      }
      if (coachPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const fullName = `${coachFirstName} ${coachLastName}`.trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: coachEmail,
        password: coachPassword,
        options: {
          data: { role: "coach", full_name: fullName, first_name: coachFirstName, last_name: coachLastName },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error("This email is already in use. Try logging in instead.");
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Account creation failed");

      await new Promise((r) => setTimeout(r, 1000));

      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: fullName,
          first_name: coachFirstName,
          last_name: coachLastName,
          default_program_id: program.id,
        })
        .eq("id", authData.user.id);

      if (updateError) console.error("Coach profile update failed:", updateError);

      await insertMemberships(supabase, authData.user.id, "coach");

      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: coachEmail,
        password: coachPassword,
      });
      if (signInError) console.error("Coach sign-in after signup failed:", signInError);

      await new Promise((r) => setTimeout(r, 500));
      window.location.href = "/api/active-profile/reset";
    } catch (err: unknown) {
      setError((err as Error).message || "Signup failed");
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (signupType === "player") handlePlayerSignup();
    else if (signupType === "parent-player") handleParentPlayerSignup();
    else handleCoachSignup();
  }

  function canSubmitPlayer() {
    return playerFirstName && playerLastName && playerEmail && playerPassword;
  }

  function canSubmitParentPlayer() {
    if (parentPlayerStep === 1) return playerFirstName && playerLastName && playerEmail && playerPassword;
    return parentFirstName && parentLastName && parentEmail && parentPassword;
  }

  function canSubmitCoach() {
    return coachFirstName && coachLastName && coachEmail && coachPassword;
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Program branding */}
        <div className={styles.branding}>
          {program.logoUrl ? (
            <img src={program.logoUrl} alt={program.name} className={styles.programLogo} />
          ) : (
            <div className={styles.programNameBadge} style={accentColor ? { background: accentColor } : undefined}>
              {program.name.charAt(0)}
            </div>
          )}
          <h1 className={styles.heading}>Join {program.name}</h1>
          <p className={styles.subtitle}>Create your account to start training</p>
        </div>

        {/* Signup type tabs */}
        <div className={styles.tabs}>
          {(["player", "parent-player", "coach"] as const).map((type) => (
            <button
              key={type}
              className={`${styles.tab} ${signupType === type ? styles.tabActive : ""}`}
              style={signupType === type && accentColor ? { background: accentColor, borderColor: accentColor } : undefined}
              onClick={() => {
                setSignupType(type);
                setError(null);
                setParentPlayerStep(1);
              }}
              type="button"
            >
              {type === "player" ? "Player" : type === "parent-player" ? "Parent + Player" : "Coach"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            {error.includes("already in use") && (
              <a href="/login" className={styles.errorLink}>Go to login →</a>
            )}
          </div>
        )}

        {/* Player form */}
        {signupType === "player" && (
          <div className={styles.form}>
            <div className={styles.inputRow}>
              <div className={styles.inputField}>
                <User size={18} />
                <input placeholder="First Name" value={playerFirstName} onChange={(e) => setPlayerFirstName(e.target.value)} required />
              </div>
              <div className={styles.inputField}>
                <User size={18} />
                <input placeholder="Last Name" value={playerLastName} onChange={(e) => setPlayerLastName(e.target.value)} required />
              </div>
            </div>
            <div className={styles.inputField}>
              <Mail size={18} />
              <input type="email" placeholder="Email" value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)} required />
            </div>
            <div className={styles.inputField}>
              <Lock size={18} />
              <input type="password" placeholder="Password" value={playerPassword} onChange={(e) => setPlayerPassword(e.target.value)} required />
            </div>
            <div>
              <label className={styles.dateLabel}>Birth Date</label>
              <div className={styles.inputField}>
                <Calendar size={18} />
                <input
                  type="date"
                  value={playerBirthDate}
                  onChange={(e) => setPlayerBirthDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  min={`${new Date().getFullYear() - 25}-01-01`}
                />
              </div>
            </div>
            <button
              className={styles.submitBtn}
              style={accentColor ? { background: accentColor } : undefined}
              onClick={handlePlayerSignup}
              disabled={loading || !canSubmitPlayer()}
              type="button"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </div>
        )}

        {/* Parent + Player form */}
        {signupType === "parent-player" && (
          <div className={styles.form}>
            {/* Progress */}
            <div className={styles.progress}>
              <div className={styles.progressStep}>
                <div className={`${styles.progressDot} ${styles.progressDotActive}`} style={accentColor ? { background: accentColor, borderColor: accentColor } : undefined}>
                  {parentPlayerStep > 1 ? <Check size={14} /> : "1"}
                </div>
                <span className={styles.progressLabel}>Player</span>
              </div>
              <div className={`${styles.progressLine} ${parentPlayerStep > 1 ? styles.progressLineActive : ""}`} style={parentPlayerStep > 1 && accentColor ? { background: accentColor } : undefined} />
              <div className={styles.progressStep}>
                <div className={`${styles.progressDot} ${parentPlayerStep >= 2 ? styles.progressDotActive : ""}`} style={parentPlayerStep >= 2 && accentColor ? { background: accentColor, borderColor: accentColor } : undefined}>
                  2
                </div>
                <span className={styles.progressLabel}>Parent</span>
              </div>
            </div>

            {parentPlayerStep === 1 && (
              <>
                <h3 className={styles.stepTitle}>Player Information</h3>
                <div className={styles.inputRow}>
                  <div className={styles.inputField}>
                    <User size={18} />
                    <input placeholder="First Name" value={playerFirstName} onChange={(e) => setPlayerFirstName(e.target.value)} required />
                  </div>
                  <div className={styles.inputField}>
                    <User size={18} />
                    <input placeholder="Last Name" value={playerLastName} onChange={(e) => setPlayerLastName(e.target.value)} required />
                  </div>
                </div>
                <div className={styles.inputField}>
                  <Mail size={18} />
                  <input type="email" placeholder="Player Email" value={playerEmail} onChange={(e) => setPlayerEmail(e.target.value)} required />
                </div>
                <div className={styles.inputField}>
                  <Lock size={18} />
                  <input type="password" placeholder="Password" value={playerPassword} onChange={(e) => setPlayerPassword(e.target.value)} required />
                </div>
                <div>
                  <label className={styles.dateLabel}>Birth Date</label>
                  <div className={styles.inputField}>
                    <Calendar size={18} />
                    <input
                      type="date"
                      value={playerBirthDate}
                      onChange={(e) => setPlayerBirthDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      min={`${new Date().getFullYear() - 25}-01-01`}
                    />
                  </div>
                </div>
                <button
                  className={styles.submitBtn}
                  style={accentColor ? { background: accentColor } : undefined}
                  onClick={() => {
                    if (!canSubmitParentPlayer()) {
                      setError("Please complete all required fields.");
                      return;
                    }
                    if (playerPassword.length < 6) {
                      setError("Password must be at least 6 characters.");
                      return;
                    }
                    setError(null);
                    setParentPlayerStep(2);
                  }}
                  type="button"
                >
                  Continue
                </button>
              </>
            )}

            {parentPlayerStep === 2 && (
              <>
                <h3 className={styles.stepTitle}>Parent Information</h3>
                <div className={styles.inputRow}>
                  <div className={styles.inputField}>
                    <User size={18} />
                    <input placeholder="First Name" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} required />
                  </div>
                  <div className={styles.inputField}>
                    <User size={18} />
                    <input placeholder="Last Name" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} required />
                  </div>
                </div>
                <div className={styles.inputField}>
                  <Mail size={18} />
                  <input type="email" placeholder="Parent Email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} required />
                </div>
                <div className={styles.inputField}>
                  <Lock size={18} />
                  <input type="password" placeholder="Password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} required />
                </div>
                <div className={styles.stepButtons}>
                  <button className={styles.backBtn} onClick={() => { setParentPlayerStep(1); setError(null); }} type="button">
                    Back
                  </button>
                  <button
                    className={styles.submitBtn}
                    style={accentColor ? { background: accentColor } : undefined}
                    onClick={handleParentPlayerSignup}
                    disabled={loading || !canSubmitParentPlayer()}
                    type="button"
                  >
                    {loading ? "Creating Accounts..." : "Sign Up"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Coach form */}
        {signupType === "coach" && (
          <div className={styles.form}>
            <div className={styles.inputRow}>
              <div className={styles.inputField}>
                <User size={18} />
                <input placeholder="First Name" value={coachFirstName} onChange={(e) => setCoachFirstName(e.target.value)} required />
              </div>
              <div className={styles.inputField}>
                <User size={18} />
                <input placeholder="Last Name" value={coachLastName} onChange={(e) => setCoachLastName(e.target.value)} required />
              </div>
            </div>
            <div className={styles.inputField}>
              <Mail size={18} />
              <input type="email" placeholder="Email" value={coachEmail} onChange={(e) => setCoachEmail(e.target.value)} required />
            </div>
            <div className={styles.inputField}>
              <Lock size={18} />
              <input type="password" placeholder="Password" value={coachPassword} onChange={(e) => setCoachPassword(e.target.value)} required />
            </div>
            <button
              className={styles.submitBtn}
              style={accentColor ? { background: accentColor } : undefined}
              onClick={handleCoachSignup}
              disabled={loading || !canSubmitCoach()}
              type="button"
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.loginLink}>
            Already have an account? <a href="/login">Log in</a>
          </p>
          <div className={styles.poweredBy}>
            <img src="/logo-light.png" alt="Homegrown" className={styles.hgLogo} />
            <span>Powered by Homegrown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
