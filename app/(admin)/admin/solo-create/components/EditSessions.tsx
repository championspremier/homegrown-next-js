"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, UserPen, Trash2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "../solo-create.module.css";
import type { SoloSession, SoloVideo } from "../solo-create-client";
import { formatLabel } from "@/lib/curriculum";

interface Props {
  sessions: SoloSession[];
  videos: SoloVideo[];
  onBack: () => void;
  onEdit: (session: SoloSession) => void;
  onDeleted: (sessionId: string) => void;
}

const CATEGORY_OPTIONS = ["all", "technical", "physical", "mental", "tactical"] as const;
const PERIOD_OPTIONS = ["all", "build-out", "middle-third", "final-third", "wide-play", "in-season", "off-season"] as const;

function estimateDuration(session: SoloSession): number {
  let minutes = 0;
  if (session.warm_up_video_id) minutes += 5;
  if (session.finishing_or_passing_video_id) minutes += 5;

  for (const drill of session.main_exercises || []) {
    const reps = drill.reps ?? 10;
    const sets = drill.sets ?? 1;
    const rest = drill.rest_time ?? 1;
    const drillTime = ((reps * 3.5) / 60) * sets;
    const restTime = rest * Math.max(0, sets - 1);
    minutes += drillTime + restTime;
  }

  return Math.max(5, Math.round(minutes));
}

export default function EditSessions({ sessions, videos, onBack, onEdit, onDeleted }: Props) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = sessions;
    if (categoryFilter !== "all") {
      list = list.filter((s) => s.category === categoryFilter);
    }
    if (periodFilter !== "all") {
      list = list.filter((s) => s.period === periodFilter);
    }
    return list;
  }, [sessions, categoryFilter, periodFilter]);

  async function handleDelete(session: SoloSession) {
    const title = session.title || `${formatLabel(session.category)} Session`;
    if (!confirm(`Delete "${title}"? Videos will be preserved.`)) return;

    setDeletingId(session.id);
    const supabase = createClient();

    try {
      const { error } = await (supabase as any)
        .from("solo_sessions")
        .update({ is_active: false })
        .eq("id", session.id);

      if (error) throw error;
      onDeleted(session.id);
    } catch (err: unknown) {
      alert(`Delete failed: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={styles.editSessions}>
      <div className={styles.editHeader}>
        <button className={styles.backBtn} onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <div>
          <h2 className={styles.editTitle}>Edit Sessions</h2>
          <p className={styles.editSubtitle}>View and manage all created sessions</p>
        </div>
      </div>

      <div className={styles.editFilters}>
        <select
          className={styles.fieldSelect}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All Categories" : formatLabel(c)}
            </option>
          ))}
        </select>
        <select
          className={styles.fieldSelect}
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          {PERIOD_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All Periods" : formatLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className={styles.editEmpty}>No sessions found.</div>
      )}

      <div className={styles.sessionCardList}>
        {filtered.map((session) => {
          const title = session.title || `${formatLabel(session.category)} Session`;
          const duration = estimateDuration(session);
          const drillCount = (session.main_exercises || []).length;
          const isDeleting = deletingId === session.id;

          return (
            <div key={session.id} className={styles.sessionCard}>
              <div className={styles.sessionCardTop}>
                <span className={styles.sessionCardTitle}>{title}</span>
                <span className={styles.activeBadge}>Active</span>
              </div>

              <div className={styles.sessionInfoRow}>
                {session.skill && (
                  <span className={styles.sessionInfoItem}>{formatLabel(session.skill)}</span>
                )}
                <span className={styles.sessionInfoItem}>{formatLabel(session.difficulty_level)}</span>
                <span className={styles.sessionInfoItem}>
                  <Clock size={13} /> ~{duration} min
                </span>
              </div>

              <div className={styles.sessionMetaGrid}>
                <div className={styles.sessionMetaCell}>
                  <span className={styles.sessionMetaLabel}>Category</span>
                  <span className={styles.sessionMetaValue}>{formatLabel(session.category)}</span>
                </div>
                <div className={styles.sessionMetaCell}>
                  <span className={styles.sessionMetaLabel}>Period</span>
                  <span className={styles.sessionMetaValue}>{formatLabel(session.period)}</span>
                </div>
                <div className={styles.sessionMetaCell}>
                  <span className={styles.sessionMetaLabel}>Skill</span>
                  <span className={styles.sessionMetaValue}>{session.skill ? formatLabel(session.skill) : "—"}</span>
                </div>
                <div className={styles.sessionMetaCell}>
                  <span className={styles.sessionMetaLabel}>Drills</span>
                  <span className={styles.sessionMetaValue}>{drillCount}</span>
                </div>
              </div>

              <span className={styles.sessionDate}>
                Created {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>

              <div className={styles.sessionActions}>
                <button
                  className={styles.editActionBtn}
                  onClick={() => onEdit(session)}
                  type="button"
                >
                  <UserPen size={15} /> Edit
                </button>
                <button
                  className={styles.deleteActionBtn}
                  onClick={() => handleDelete(session)}
                  disabled={isDeleting}
                  type="button"
                >
                  <Trash2 size={15} /> {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
