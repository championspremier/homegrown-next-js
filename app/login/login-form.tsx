"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/forms.module.css";
import layoutStyles from "@/components/layout/layout.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    // Full-page navigation so the next request is a clean GET that carries cookies (no POST redirect).
    await new Promise((r) => setTimeout(r, 400));
    window.location.assign("/api/active-profile/reset");
  }

  return (
    <main className={layoutStyles.authPage}>
      <h1 className={layoutStyles.authTitle}>Log in</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
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
            autoComplete="current-password"
            className={styles.formInput}
          />
        </div>
        <div className={styles.formGroup} role="alert" aria-live="polite">
          {error ? <span className={styles.formError}>{error}</span> : null}
        </div>
        <button type="submit" disabled={loading} className={styles.formSubmit}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className={layoutStyles.authMuted}>
        <a href="/signup">Sign up</a> if you don&apos;t have an account.
      </p>
    </main>
  );
}
