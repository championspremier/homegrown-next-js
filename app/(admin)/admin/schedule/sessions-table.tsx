"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "@/app/actions/admin";
import { localDateTimeToUtcIso } from "@/lib/datetime";
import styles from "@/components/layout/layout.module.css";
import formStyles from "@/components/forms.module.css";

export type SessionRow = {
  id: string;
  type: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  coach_id: string;
  coach_name: string | null;
  coach_email: string | null;
};

export type CoachOption = { id: string; full_name: string | null; email: string | null };

interface SessionsTableProps {
  sessions: SessionRow[];
  coaches: CoachOption[];
}

/** Format UTC ISO timestamptz in the viewer's local time. */
function formatDatetime(utcIso: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return utcIso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function SessionsTable({ sessions, coaches }: SessionsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const coach_id = formData.get("coach_id") as string;
    const type = formData.get("type") as string;
    const starts_at = formData.get("starts_at") as string;
    const ends_at = formData.get("ends_at") as string;
    const capacity = parseInt(formData.get("capacity") as string, 10);
    if (!coach_id || !type?.trim() || !starts_at || !ends_at || Number.isNaN(capacity)) {
      setError("All fields are required.");
      return;
    }
    const startsAtUtc = localDateTimeToUtcIso(starts_at);
    const endsAtUtc = localDateTimeToUtcIso(ends_at);
    startTransition(async () => {
      const { error: err } = await createSession({
        coach_id,
        type: type.trim(),
        starts_at: startsAtUtc,
        ends_at: endsAtUtc,
        capacity,
      });
      if (err) {
        setError(err);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className={styles.shellContent}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          type="button"
          className={styles.signOutBtn}
          onClick={() => setShowForm(true)}
          disabled={isPending}
        >
          Create session
        </button>
      </div>

      {showForm && (
        <div className={styles.widget} style={{ marginBottom: "1.5rem" }}>
          <h2 className={styles.widgetTitle}>New session</h2>
          <form
            onSubmit={handleSubmit}
            className={formStyles.form}
            style={{ maxWidth: "28rem" }}
          >
            <div className={formStyles.formGroup}>
              <label className={formStyles.formLabel} htmlFor="create-coach_id">
                Coach
              </label>
              <select
                id="create-coach_id"
                name="coach_id"
                required
                className={formStyles.formInput}
                disabled={isPending}
              >
                <option value="">Select coach</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name || c.email || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className={formStyles.formGroup}>
              <label className={formStyles.formLabel} htmlFor="create-type">
                Type
              </label>
              <input
                id="create-type"
                name="type"
                type="text"
                required
                placeholder="e.g. speed, tec tac, cpp"
                className={formStyles.formInput}
                disabled={isPending}
              />
            </div>
            <div className={formStyles.formGroup}>
              <label className={formStyles.formLabel} htmlFor="create-starts_at">
                Starts at
              </label>
              <input
                id="create-starts_at"
                name="starts_at"
                type="datetime-local"
                required
                className={formStyles.formInput}
                disabled={isPending}
              />
            </div>
            <div className={formStyles.formGroup}>
              <label className={formStyles.formLabel} htmlFor="create-ends_at">
                Ends at
              </label>
              <input
                id="create-ends_at"
                name="ends_at"
                type="datetime-local"
                required
                className={formStyles.formInput}
                disabled={isPending}
              />
            </div>
            <div className={formStyles.formGroup}>
              <label className={formStyles.formLabel} htmlFor="create-capacity">
                Capacity
              </label>
              <input
                id="create-capacity"
                name="capacity"
                type="number"
                min={1}
                required
                defaultValue={1}
                className={formStyles.formInput}
                disabled={isPending}
              />
            </div>
            {error && <p className={formStyles.formError}>{error}</p>}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button
                type="submit"
                className={formStyles.formSubmit}
                disabled={isPending}
              >
                {isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className={styles.signOutBtn}
                onClick={() => { setShowForm(false); setError(null); }}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Starts at</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Ends at</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Capacity</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Coach</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0.75rem" }}>{s.type}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>{formatDatetime(s.starts_at)}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>{formatDatetime(s.ends_at)}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>{s.capacity}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>
                {s.coach_name || s.coach_email || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sessions.length === 0 && !showForm && (
        <p className={styles.muted} style={{ marginTop: "1rem" }}>
          No sessions yet. Create one to get started.
        </p>
      )}
    </div>
  );
}
