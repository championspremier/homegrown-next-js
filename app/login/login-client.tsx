"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Mail,
  Lock,
  Calendar,
  Trophy,
  Shield,
  CheckSquare,
  Share2,
  Users,
  Phone,
  Check,
} from "lucide-react";
import styles from "./login.module.css";

type Mode = "login" | "signup";
type SignupStep = "role" | "player-1" | "player-2" | "parent" | "coach";

export default function LoginClient() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Signup state
  const [signupStep, setSignupStep] = useState<SignupStep>("role");
  const [signupRole, setSignupRole] = useState<"player" | "parent-player" | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  // Player fields
  const [playerFirstName, setPlayerFirstName] = useState("");
  const [playerLastName, setPlayerLastName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerPassword, setPlayerPassword] = useState("");
  const [playerBirthDate, setPlayerBirthDate] = useState("");
  const [playerTeamName, setPlayerTeamName] = useState("");
  const [playerProgramType, setPlayerProgramType] = useState("");
  const [playerCompetitiveLevel, setPlayerCompetitiveLevel] = useState("");
  const [playerPositions, setPlayerPositions] = useState<string[]>([]);
  const [playerReferralSource, setPlayerReferralSource] = useState("");

  // Parent fields
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentBirthDate, setParentBirthDate] = useState("");

  // Coach fields
  const [coachFirstName, setCoachFirstName] = useState("");
  const [coachLastName, setCoachLastName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachPassword, setCoachPassword] = useState("");
  const [coachPhone, setCoachPhone] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Handlers ── */

  async function handleLogin() {
    setLoginLoading(true);
    setLoginError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setLoginLoading(false);
      setLoginError(error.message);
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
    window.location.assign("/api/active-profile/reset");
  }

  async function handleForgotPassword() {
    setForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail);
    setForgotLoading(false);
    if (error) {
      setForgotError(error.message);
    } else {
      setForgotMessage("Reset link sent! Check your email.");
    }
  }

  function validateAndContinue(nextStep: SignupStep) {
    if (signupStep === "player-1") {
      if (
        !playerFirstName ||
        !playerLastName ||
        !playerEmail ||
        !playerPassword ||
        !playerBirthDate ||
        !playerProgramType
      ) {
        setSignupError("Please complete all required fields.");
        return;
      }
      if (playerPassword.length < 6) {
        setSignupError("Password must be at least 6 characters.");
        return;
      }
    }
    if (signupStep === "player-2") {
      if (!playerCompetitiveLevel) {
        setSignupError("Please select a competitive level.");
        return;
      }
    }
    setSignupError(null);
    setSignupStep(nextStep);
  }

  async function handlePlayerSignup() {
    setSignupLoading(true);
    setSignupError(null);
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
          data: {
            role: "player",
            full_name: fullName,
            first_name: playerFirstName,
            last_name: playerLastName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      await new Promise((r) => setTimeout(r, 1000));

      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: fullName,
          first_name: playerFirstName,
          last_name: playerLastName,
          program_type: playerProgramType || null,
          competitive_level: playerCompetitiveLevel || null,
          team_name: playerTeamName || null,
          birth_date: playerBirthDate || null,
          positions: playerPositions.length > 0 ? playerPositions : null,
          referral_source: playerReferralSource || null,
        })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Player profile update failed:", updateError);
      }

      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: playerEmail,
        password: playerPassword,
      });
      if (signInError) {
        console.error("Player sign-in after signup failed:", signInError);
      }

      await new Promise((r) => setTimeout(r, 500));
      window.location.href = "/api/active-profile/reset";
    } catch (err: unknown) {
      setSignupError((err as Error).message || "Signup failed");
      setSignupLoading(false);
    }
  }

  async function handleParentPlayerSignup() {
    setSignupLoading(true);
    setSignupError(null);
    const supabase = createClient();

    try {
      const parentFullName = `${parentFirstName} ${parentLastName}`.trim();
      const playerFullName = `${playerFirstName} ${playerLastName}`.trim();

      // Step 1: Create parent account
      const { data: parentAuthData, error: parentAuthError } = await supabase.auth.signUp({
        email: parentEmail,
        password: parentPassword,
        options: {
          data: {
            role: "parent",
            full_name: parentFullName,
            first_name: parentFirstName,
            last_name: parentLastName,
          },
        },
      });

      if (parentAuthError) throw new Error(`Parent account: ${parentAuthError.message}`);
      if (!parentAuthData.user) throw new Error("Parent user creation failed");

      const parentId = parentAuthData.user.id;

      await new Promise((r) => setTimeout(r, 1000));

      const { error: parentUpdateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: parentFullName,
          first_name: parentFirstName,
          last_name: parentLastName,
          phone_number: parentPhone || null,
          birth_date: parentBirthDate || null,
        })
        .eq("id", parentId);

      if (parentUpdateError) console.error("Parent profile update failed:", parentUpdateError);

      // Store parent session tokens before signing out
      const {
        data: { session: parentSession },
      } = await supabase.auth.getSession();
      const parentAccessToken = parentSession?.access_token;
      const parentRefreshToken = parentSession?.refresh_token;

      if (!parentAccessToken || !parentRefreshToken) {
        console.error("Could not get parent session tokens");
      }

      // Step 2: Sign out parent, create player account
      await supabase.auth.signOut();

      const { data: playerAuthData, error: playerAuthError } = await supabase.auth.signUp({
        email: playerEmail,
        password: playerPassword,
        options: {
          data: {
            role: "player",
            full_name: playerFullName,
            first_name: playerFirstName,
            last_name: playerLastName,
          },
        },
      });

      if (playerAuthError) throw new Error(`Player account: ${playerAuthError.message}`);
      if (!playerAuthData.user) throw new Error("Player user creation failed");

      const playerId = playerAuthData.user.id;

      await new Promise((r) => setTimeout(r, 1000));

      const { error: playerUpdateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: playerFullName,
          first_name: playerFirstName,
          last_name: playerLastName,
          program_type: playerProgramType || null,
          competitive_level: playerCompetitiveLevel || null,
          team_name: playerTeamName || null,
          birth_date: playerBirthDate || null,
          positions: playerPositions.length > 0 ? playerPositions : null,
          referral_source: playerReferralSource || null,
        })
        .eq("id", playerId);

      if (playerUpdateError) console.error("Player profile update failed:", playerUpdateError);

      // Step 3: Sign out player, restore parent session to create relationship
      await supabase.auth.signOut();

      let restoredAsParent = false;

      if (parentAccessToken && parentRefreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: parentAccessToken,
          refresh_token: parentRefreshToken,
        });
        if (!setSessionError) {
          restoredAsParent = true;
        } else {
          console.error("setSession failed:", setSessionError);
        }
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
        .insert({
          parent_id: parentId,
          player_id: playerId,
        });

      if (relationshipError) {
        console.error("Failed to create parent-player relationship:", relationshipError);
      }

      window.location.assign("/api/active-profile/reset");
    } catch (err: unknown) {
      setSignupError((err as Error).message || "Signup failed");
      setSignupLoading(false);
    }
  }

  async function handleCoachSignup() {
    setSignupLoading(true);
    setSignupError(null);
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
          data: {
            role: "coach",
            full_name: fullName,
            first_name: coachFirstName,
            last_name: coachLastName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Account creation failed");

      await new Promise((r) => setTimeout(r, 1000));

      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: fullName,
          first_name: coachFirstName,
          last_name: coachLastName,
          phone_number: coachPhone || null,
        })
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Coach profile update failed:", updateError);
      }

      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: coachEmail,
        password: coachPassword,
      });
      if (signInError) {
        console.error("Coach sign-in after signup failed:", signInError);
      }

      await new Promise((r) => setTimeout(r, 500));
      window.location.href = "/api/active-profile/reset";
    } catch (err: unknown) {
      setSignupError((err as Error).message || "Signup failed");
      setSignupLoading(false);
    }
  }

  /* ── Step helpers ── */

  function getSteps(): string[] {
    if (signupRole === "parent-player") return ["Player 1", "Player 2", "Parent"];
    return ["Player 1", "Player 2"];
  }

  function getCurrentStepIndex(): number {
    if (signupStep === "player-1") return 0;
    if (signupStep === "player-2") return 1;
    if (signupStep === "parent") return 2;
    return 0;
  }

  /* ── Renderers ── */

  function renderLoginForm() {
    if (showForgotPassword) {
      return (
        <>
          <h2 className={styles.formTitle}>Reset Password</h2>
          <div className={styles.inputField}>
            <Mail size={18} />
            <input
              type="email"
              placeholder="Email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {forgotError && <p className={styles.errorText}>{forgotError}</p>}
          {forgotMessage && <p className={styles.successText}>{forgotMessage}</p>}
          <button
            className={styles.submitBtn}
            onClick={handleForgotPassword}
            disabled={forgotLoading || !forgotEmail}
          >
            {forgotLoading ? "Sending..." : "Send Reset Link"}
          </button>
          <button
            className={styles.forgotBackLink}
            onClick={() => {
              setShowForgotPassword(false);
              setForgotError(null);
              setForgotMessage(null);
            }}
          >
            Back to Sign In
          </button>
          <div className={styles.mobileToggle}>
            New here?{" "}
            <button className={styles.mobileToggleLink} onClick={() => setMode("signup")}>
              Sign Up
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <h2 className={styles.formTitle}>Sign In</h2>
        <div className={styles.inputField}>
          <Mail size={18} />
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className={styles.inputField}>
          <Lock size={18} />
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {loginError && <p className={styles.errorText}>{loginError}</p>}
        <button className={styles.submitBtn} onClick={handleLogin} disabled={loginLoading}>
          {loginLoading ? "Signing In..." : "Login"}
        </button>
        <button
          className={styles.forgotPasswordBtn}
          onClick={() => setShowForgotPassword(true)}
        >
          Forgot Password?
        </button>
        <div className={styles.mobileToggle}>
          New here?{" "}
          <button className={styles.mobileToggleLink} onClick={() => setMode("signup")}>
            Sign Up
          </button>
        </div>
      </>
    );
  }

  function renderRoleSelection() {
    return (
      <>
        <h2 className={styles.formTitle}>Create a Login for...</h2>
        <div className={styles.roleOptions}>
          <button
            className={styles.roleCard}
            onClick={() => {
              setSignupRole("player");
              setSignupStep("player-1");
              setSignupError(null);
            }}
          >
            <User size={32} />
            <span>Player Only</span>
          </button>
          <span className={styles.roleDivider}>OR</span>
          <button
            className={styles.roleCard}
            onClick={() => {
              setSignupRole("parent-player");
              setSignupStep("player-1");
              setSignupError(null);
            }}
          >
            <Users size={32} />
            <span>Parent + Player</span>
          </button>
        </div>
        <p className={styles.coachSignupHint}>
          Are you a coach?{" "}
          <button
            className={styles.mobileToggleLink}
            onClick={() => {
              setSignupStep("coach");
              setSignupError(null);
            }}
          >
            Coach Sign Up
          </button>
        </p>
      </>
    );
  }

  function renderPlayerStep1() {
    return (
      <>
        <h2 className={styles.formTitle}>Player Information</h2>
        <div className={styles.inputField}>
          <User size={18} />
          <input
            placeholder="First Name"
            value={playerFirstName}
            onChange={(e) => setPlayerFirstName(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <User size={18} />
          <input
            placeholder="Last Name"
            value={playerLastName}
            onChange={(e) => setPlayerLastName(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <Mail size={18} />
          <input
            type="email"
            placeholder="Player Email"
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <Lock size={18} />
          <input
            type="password"
            placeholder="Password"
            value={playerPassword}
            onChange={(e) => setPlayerPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className={styles.inputField}>
          <Calendar size={18} />
          <input
            type="date"
            placeholder="Birth Date"
            value={playerBirthDate}
            onChange={(e) => setPlayerBirthDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            min={`${new Date().getFullYear() - 25}-01-01`}
          />
        </div>
        <div className={styles.inputField}>
          <Shield size={18} />
          <input
            placeholder="Team/Club Name (e.g., NVA, DCU)"
            value={playerTeamName}
            onChange={(e) => setPlayerTeamName(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <CheckSquare size={18} />
          <select
            value={playerProgramType}
            onChange={(e) => setPlayerProgramType(e.target.value)}
          >
            <option value="">I&apos;m here for the...</option>
            <option value="On-field Program">On-field Program</option>
            <option value="The Virtual Program">The Virtual Program</option>
            <option value="Homegrown App">Homegrown App</option>
          </select>
        </div>
        {signupError && <p className={styles.errorText}>{signupError}</p>}
        <div className={styles.stepButtons}>
          <button
            className={styles.backBtn}
            onClick={() => {
              setSignupStep("role");
              setSignupError(null);
            }}
          >
            Back
          </button>
          <button className={styles.continueBtn} onClick={() => validateAndContinue("player-2")}>
            Continue
          </button>
        </div>
      </>
    );
  }

  function renderPlayerStep2() {
    return (
      <>
        <h2 className={styles.formTitle}>Almost There!</h2>
        <div className={styles.inputField}>
          <Trophy size={18} />
          <select
            value={playerCompetitiveLevel}
            onChange={(e) => setPlayerCompetitiveLevel(e.target.value)}
          >
            <option value="">Competitive Level</option>
            <option value="MLS Next Homegrown">MLS Next Homegrown</option>
            <option value="MLS Next Academy">MLS Next Academy</option>
            <option value="ECNL">ECNL</option>
            <option value="ECNL RL">ECNL RL</option>
            <option value="NCSL">NCSL</option>
            <option value="NAL">NAL</option>
            <option value="EDP">EDP</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className={styles.positionsSection}>
          <label className={styles.positionsLabel}>Select Positions</label>
          <div className={styles.positionsGrid}>
            {[
              "GK",
              "Central Defender",
              "Mid-Defensive",
              "Mid-Offensive",
              "Winger",
              "Full-Back",
              "Forward",
            ].map((pos) => (
              <label
                key={pos}
                className={`${styles.positionCheckbox} ${
                  playerPositions.includes(pos) ? styles.positionChecked : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={playerPositions.includes(pos)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setPlayerPositions([...playerPositions, pos]);
                    else
                      setPlayerPositions(playerPositions.filter((p) => p !== pos));
                  }}
                />
                {pos}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.inputField}>
          <Share2 size={18} />
          <select
            value={playerReferralSource}
            onChange={(e) => setPlayerReferralSource(e.target.value)}
          >
            <option value="">How&apos;d you hear about us?</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="Tik Tok">Tik Tok</option>
            <option value="Coach">Coach</option>
            <option value="Referral">Referral</option>
            <option value="Google">Google</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {signupError && <p className={styles.errorText}>{signupError}</p>}

        <div className={styles.stepButtons}>
          <button
            className={styles.backBtn}
            onClick={() => {
              setSignupStep("player-1");
              setSignupError(null);
            }}
          >
            Back
          </button>
          {signupRole === "player" ? (
            <button
              className={styles.submitBtn}
              onClick={handlePlayerSignup}
              disabled={signupLoading}
            >
              {signupLoading ? "Creating Account..." : "Sign Up"}
            </button>
          ) : (
            <button
              className={styles.continueBtn}
              onClick={() => validateAndContinue("parent")}
            >
              Continue
            </button>
          )}
        </div>
      </>
    );
  }

  function renderParentStep() {
    return (
      <>
        <h2 className={styles.formTitle}>Parent Information</h2>
        <div className={styles.inputField}>
          <User size={18} />
          <input
            placeholder="First Name"
            value={parentFirstName}
            onChange={(e) => setParentFirstName(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <User size={18} />
          <input
            placeholder="Last Name"
            value={parentLastName}
            onChange={(e) => setParentLastName(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <Mail size={18} />
          <input
            type="email"
            placeholder="Parent Email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <Lock size={18} />
          <input
            type="password"
            placeholder="Password"
            value={parentPassword}
            onChange={(e) => setParentPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className={styles.inputField}>
          <Phone size={18} />
          <input
            type="tel"
            placeholder="Phone Number"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
        </div>
        <div className={styles.inputField}>
          <Calendar size={18} />
          <input
            type="date"
            placeholder="Birth Date"
            value={parentBirthDate}
            onChange={(e) => setParentBirthDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            min="1950-01-01"
          />
        </div>

        {signupError && <p className={styles.errorText}>{signupError}</p>}

        <div className={styles.stepButtons}>
          <button
            className={styles.backBtn}
            onClick={() => {
              setSignupStep("player-2");
              setSignupError(null);
            }}
          >
            Back
          </button>
          <button
            className={styles.submitBtn}
            onClick={handleParentPlayerSignup}
            disabled={signupLoading}
          >
            {signupLoading ? "Creating Accounts..." : "Sign Up"}
          </button>
        </div>
      </>
    );
  }

  function renderSignupFlow() {
    const steps = getSteps();
    const currentStepIndex = getCurrentStepIndex();

    return (
      <>
        {signupStep !== "role" && signupStep !== "coach" && (
          <div className={styles.progressBar}>
            {steps.map((_, i) => (
              <div key={i} className={styles.progressStep}>
                <div
                  className={`${styles.progressDot} ${
                    i <= currentStepIndex ? styles.progressDotActive : ""
                  }`}
                >
                  {i < currentStepIndex ? <Check size={14} /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`${styles.progressLine} ${
                      i < currentStepIndex ? styles.progressLineActive : ""
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {signupStep === "role" && renderRoleSelection()}
        {signupStep === "player-1" && renderPlayerStep1()}
        {signupStep === "player-2" && renderPlayerStep2()}
        {signupStep === "parent" && renderParentStep()}

        {signupStep === "coach" && (
          <>
            <h2 className={styles.formTitle}>Coach Sign Up</h2>
            <div className={styles.inputField}>
              <User size={18} />
              <input
                placeholder="First Name"
                value={coachFirstName}
                onChange={(e) => setCoachFirstName(e.target.value)}
              />
            </div>
            <div className={styles.inputField}>
              <User size={18} />
              <input
                placeholder="Last Name"
                value={coachLastName}
                onChange={(e) => setCoachLastName(e.target.value)}
              />
            </div>
            <div className={styles.inputField}>
              <Mail size={18} />
              <input
                type="email"
                placeholder="Email"
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
              />
            </div>
            <div className={styles.inputField}>
              <Lock size={18} />
              <input
                type="password"
                placeholder="Password"
                value={coachPassword}
                onChange={(e) => setCoachPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className={styles.inputField}>
              <Phone size={18} />
              <input
                type="tel"
                placeholder="Phone Number"
                value={coachPhone}
                onChange={(e) => setCoachPhone(e.target.value)}
              />
            </div>

            {signupError && <p className={styles.errorText}>{signupError}</p>}

            <div className={styles.stepButtons}>
              <button
                className={styles.backBtn}
                onClick={() => {
                  setSignupStep("role");
                  setSignupError(null);
                }}
              >
                Back
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleCoachSignup}
                disabled={signupLoading}
              >
                {signupLoading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </>
        )}

        <div className={styles.mobileToggle}>
          Already have an account?{" "}
          <button
            className={styles.mobileToggleLink}
            onClick={() => {
              setMode("login");
              setSignupStep("role");
            }}
          >
            Sign In
          </button>
        </div>
      </>
    );
  }

  if (!mounted) {
    return (
      <div className={styles.container}>
        <div className={styles.formsContainer}>
          <div className={styles.signinSignup} />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${mode === "signup" ? styles.signUpMode : ""}`} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-light.png"
        className={styles.topLogo}
        alt="Homegrown"
        style={{ opacity: mode === "login" ? 1 : 0, pointerEvents: "none" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.png"
        className={styles.topLogo}
        alt="Homegrown"
        style={{ opacity: mode === "signup" ? 1 : 0, pointerEvents: "none" }}
      />

      <div className={styles.formsContainer}>
        <div className={styles.signinSignup}>
          <div className={`${styles.formWrapper} ${styles.signInForm}`}>
            {renderLoginForm()}
          </div>

          <div className={`${styles.formWrapper} ${styles.signUpForm}`}>
            {renderSignupFlow()}
          </div>
        </div>
      </div>

      <div className={styles.panelsContainer}>
        <div className={`${styles.panel} ${styles.leftPanel}`}>
          <div className={styles.panelContent}>
            <h3>New Here?</h3>
            <p>
              Join Homegrown and start your journey to becoming an elite soccer
              player.
            </p>
            <button className={styles.panelBtn} onClick={() => setMode("signup")}>
              Sign Up
            </button>
          </div>
        </div>
        <div className={`${styles.panel} ${styles.rightPanel}`}>
          <div className={styles.panelContent}>
            <h3>One of Us?</h3>
            <p>
              Welcome back! Sign in to continue your development journey.
            </p>
            <button
              className={styles.panelBtn}
              onClick={() => {
                setMode("login");
                setSignupStep("role");
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>

      {signupStep !== "coach" && (
        <button
          className={styles.coachLoginLink}
          onClick={() => {
            setMode("signup");
            setSignupStep("coach");
            setSignupError(null);
          }}
        >
          Coach Sign Up
        </button>
      )}
    </div>
  );
}
