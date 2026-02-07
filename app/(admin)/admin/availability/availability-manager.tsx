"use client";

import { useTransition, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createAvailability, deleteAvailability } from "@/app/actions/admin";
import styles from "@/components/layout/layout.module.css";
import formStyles from "@/components/forms.module.css";

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export type CoachOption = { id: string; full_name: string | null; email: string | null };

export type AvailabilityRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
};

interface AvailabilityManagerProps {
  coaches: CoachOption[];
  selectedCoachId: string | null;
  availability: AvailabilityRow[];
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(t: string): string {
  if (!t) return "—";
  const parts = t.split(":");
  if (parts.length >= 2) return `${parts[0].padStart(2, "0")}:${parts[1]}`;
  return t;
}

export function AvailabilityManager({
  coaches,
  selectedCoachId,
  availability,
}: AvailabilityManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  function handleCoachChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) return;
    const params = new URLSearchParams();
    params.set("coach", id);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!selectedCoachId) {
      setError("Select a coach first.");
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);
    const day_of_week = parseInt(formData.get("day_of_week") as string, 10);
    const start_time = (formData.get("start_time") as string)?.trim() ?? "";
    const end_time = (formData.get("end_time") as string)?.trim() ?? "";
    if (Number.isNaN(day_of_week) || day_of_week < 0 || day_of_week > 6) {
      setError("Invalid day.");
      return;
    }
    if (!start_time || !end_time) {
      setError("Start and end time are required.");
      return;
    }
    if (start_time >= end_time) {
      setError("Start time must be before end time.");
      return;
    }
    startTransition(async () => {
      const { error: err } = await createAvailability({
        coach_id: selectedCoachId,
        day_of_week,
        start_time,
        end_time,
      });
      if (err) {
        setError(err);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const { error: err } = await deleteAvailability({ id });
      if (err) setError(err);
      else router.refresh();
    });
  }

  if (coaches.length === 0) {
    return (
      <div className={styles.shellContent}>
        <p className={styles.muted}>No coaches found. Add users with role &quot;coach&quot; first.</p>
      </div>
    );
  }

  return (
    <div className={styles.shellContent}>
      <div className={styles.widget} style={{ marginBottom: "1.5rem" }}>
        <label className={formStyles.formLabel} htmlFor="availability-coach">
          Coach
        </label>
        <select
          id="availability-coach"
          value={selectedCoachId ?? ""}
          onChange={handleCoachChange}
          className={formStyles.formInput}
          style={{ maxWidth: "20rem" }}
          disabled={isPending}
        >
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.email || c.id}
            </option>
          ))}
        </select>
      </div>

      {selectedCoachId && (
        <>
          <div className={styles.widget} style={{ marginBottom: "1.5rem" }}>
            <h2 className={styles.widgetTitle}>Add availability</h2>
            <form onSubmit={handleAddSubmit} className={formStyles.form} style={{ maxWidth: "24rem" }}>
              <div className={formStyles.formGroup}>
                <label className={formStyles.formLabel} htmlFor="add-day_of_week">
                  Day
                </label>
                <select
                  id="add-day_of_week"
                  name="day_of_week"
                  required
                  className={formStyles.formInput}
                  disabled={isPending}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={formStyles.formGroup}>
                <label className={formStyles.formLabel} htmlFor="add-start_time">
                  Start time
                </label>
                <input
                  id="add-start_time"
                  name="start_time"
                  type="time"
                  required
                  className={formStyles.formInput}
                  disabled={isPending}
                />
              </div>
              <div className={formStyles.formGroup}>
                <label className={formStyles.formLabel} htmlFor="add-end_time">
                  End time
                </label>
                <input
                  id="add-end_time"
                  name="end_time"
                  type="time"
                  required
                  className={formStyles.formInput}
                  disabled={isPending}
                />
              </div>
              {error && <p className={formStyles.formError}>{error}</p>}
              <button type="submit" className={formStyles.formSubmit} disabled={isPending}>
                {isPending ? "Adding…" : "Add"}
              </button>
            </form>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>Day</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Start</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>End</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Created</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {availability.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{DAY_LABELS[row.day_of_week] ?? row.day_of_week}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{formatTime(row.start_time)}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{formatTime(row.end_time)}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>{formatCreatedAt(row.created_at)}</td>
                  <td style={{ padding: "0.5rem 0.75rem" }}>
                    <button
                      type="button"
                      className={styles.signOutBtn}
                      onClick={() => handleDelete(row.id)}
                      disabled={isPending}
                      aria-label={`Delete ${DAY_LABELS[row.day_of_week]} ${formatTime(row.start_time)}–${formatTime(row.end_time)}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {availability.length === 0 && (
            <p className={styles.muted} style={{ marginTop: "1rem" }}>
              No availability blocks yet. Add one above.
            </p>
          )}
        </>
      )}
    </div>
  );
}
