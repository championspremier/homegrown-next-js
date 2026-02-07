"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { linkPlayerToParentByEmail } from "@/app/actions/account";
import formStyles from "@/components/forms.module.css";

export function LinkPlayerForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const form = e.currentTarget;
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement)?.value?.trim();
    if (!email) {
      setError("Email is required.");
      return;
    }
    startTransition(async () => {
      const { error: err } = await linkPlayerToParentByEmail(email);
      if (err) {
        setError(err);
        return;
      }
      setSuccess(true);
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className={formStyles.form} style={{ maxWidth: "24rem", marginTop: "0.75rem" }}>
      <div className={formStyles.formGroup}>
        <label className={formStyles.formLabel} htmlFor="link-player-email">
          Player email
        </label>
        <input
          id="link-player-email"
          name="email"
          type="email"
          required
          placeholder="player@example.com"
          className={formStyles.formInput}
          disabled={isPending}
        />
      </div>
      {error && <p className={formStyles.formError}>{error}</p>}
      {success && <p style={{ color: "var(--primary)", fontSize: "0.875rem" }}>Player linked successfully.</p>}
      <button type="submit" className={formStyles.formSubmit} disabled={isPending}>
        {isPending ? "Linking…" : "Link player"}
      </button>
    </form>
  );
}
