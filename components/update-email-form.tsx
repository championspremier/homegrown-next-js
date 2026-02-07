"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyEmail } from "@/app/actions/profile";
import styles from "@/components/forms.module.css";
import layoutStyles from "@/components/layout/layout.module.css";

interface UpdateEmailFormProps {
  currentEmail: string | null;
}

export function UpdateEmailForm({ currentEmail }: UpdateEmailFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setPendingMessage(null);
    const form = e.currentTarget;
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement)?.value?.trim();
    if (!email) {
      setError("Email is required.");
      return;
    }
    startTransition(async () => {
      const result = await updateMyEmail(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.pending && result.message) {
        setPendingMessage(result.message);
        router.refresh();
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <>
    <form onSubmit={handleSubmit} className={styles.form} style={{ maxWidth: "24rem", marginTop: "0.75rem" }}>
      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="update-email">
          Login email
        </label>
        <input
          id="update-email"
          name="email"
          type="email"
          required
          defaultValue={currentEmail ?? ""}
          placeholder="you@example.com"
          className={styles.formInput}
          disabled={isPending}
        />
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      {success && <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>Email updated successfully.</p>}
      <button type="submit" className={styles.formSubmit} disabled={isPending}>
        {isPending ? "Updating…" : "Update email"}
      </button>
    </form>
    {pendingMessage && (
      <div style={{ marginTop: "0.75rem" }}>
        <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>{pendingMessage}</p>
        <p className={layoutStyles.mutedNoMargin} style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
          After confirming, sign out and sign in again with your new email.
        </p>
        <form method="POST" action="/api/auth/signout" style={{ display: "inline-block", marginTop: "0.5rem" }}>
          <button type="submit" style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}>
            Sign out
          </button>
        </form>
      </div>
    )}
    </>
  );
}
