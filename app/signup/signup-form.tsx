"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/forms.module.css";

const SIGNUP_ROLES = [
  { value: "parent", label: "Parent" },
  { value: "player", label: "Player" },
  { value: "coach", label: "Coach" },
] as const;
type SignupRole = (typeof SIGNUP_ROLES)[number]["value"];

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<SignupRole>("parent");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
    if (data?.user && !data?.session) {
      window.location.assign("/check-email");
      return;
    }
    if (data?.session) {
      window.location.assign("/api/active-profile/reset");
      return;
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formGroup}>
        <label htmlFor="fullName" className={styles.formLabel}>
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          className={styles.formInput}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="signupRole" className={styles.formLabel}>
          I am a:
        </label>
        <select
          id="signupRole"
          value={role}
          onChange={(e) => setRole((e.target.value as SignupRole) || "parent")}
          className={styles.formInput}
          aria-label="Account type"
        >
          {SIGNUP_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="email" className={styles.formLabel}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={styles.formInput}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="password" className={styles.formLabel}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className={styles.formInput}
        />
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      <button type="submit" disabled={loading} className={styles.formSubmit}>
        {loading ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
