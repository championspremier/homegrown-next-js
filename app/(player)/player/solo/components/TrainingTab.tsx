"use client";

import { useState, useMemo } from "react";
import {
  Dumbbell,
  Target,
  Zap,
  User,
  Trash2,
  Plus,
  ChevronDown,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./TrainingTab.module.css";

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  category: string | null;
  equipment: string | null;
}

export interface TrainingLog {
  id: string;
  player_id: string;
  training_type: string;
  title: string | null;
  duration_minutes: number;
  training_date: string;
  notes: string | null;
  exercises: ExerciseEntry[] | null;
  coach_name: string | null;
  created_at: string;
}

interface ExerciseEntry {
  name: string;
  sets: number;
  reps: number;
  load_lbs?: number | null;
}

interface Props {
  exerciseLibrary: ExerciseLibraryItem[];
  recentTrainingLogs: TrainingLog[];
  playerId: string;
  weeklyHgMinutes?: number;
  eliteTargetHours?: number;
}

const TRAINING_TYPES = [
  { key: "team-training", label: "Team Training", icon: Target, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  { key: "strength", label: "Strength", icon: Dumbbell, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  { key: "speed", label: "Speed", icon: Zap, color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  { key: "individual-session", label: "Individual Session", icon: User, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
] as const;

type TrainingTypeKey = typeof TRAINING_TYPES[number]["key"];

const TYPE_MAP = Object.fromEntries(TRAINING_TYPES.map((t) => [t.key, t]));

const PLACEHOLDERS: Record<TrainingTypeKey, string> = {
  "team-training": "e.g. Club practice, Scrimmage",
  strength: "e.g. Leg day",
  speed: "e.g. Sprint intervals",
  "individual-session": "e.g. 1v1 with coach",
};

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function TrainingTab({ exerciseLibrary, recentTrainingLogs, playerId, weeklyHgMinutes = 0, eliteTargetHours = 8 }: Props) {
  const [logs, setLogs] = useState<TrainingLog[]>(recentTrainingLogs);
  const [selectedType, setSelectedType] = useState<TrainingTypeKey | null>(null);

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [trainingDate, setTrainingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [coachName, setCoachName] = useState("");

  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [exName, setExName] = useState("");
  const [exSets, setExSets] = useState("3");
  const [exReps, setExReps] = useState("10");
  const [exLoad, setExLoad] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const weeklyHours = useMemo(() => {
    const { start, end } = getWeekRange();
    let manualMin = 0;
    for (const log of logs) {
      const d = new Date(log.training_date + "T00:00:00");
      if (d >= start && d <= end) manualMin += log.duration_minutes;
    }
    const totalMin = manualMin + weeklyHgMinutes;
    return (totalMin / 60).toFixed(1);
  }, [logs, weeklyHgMinutes]);

  const elitePercent = useMemo(() => {
    const pct = (parseFloat(weeklyHours) / eliteTargetHours) * 100;
    return Math.min(100, pct);
  }, [weeklyHours, eliteTargetHours]);

  const eliteBarColor = useMemo(() => {
    if (elitePercent >= 80) return "#22c55e";
    if (elitePercent >= 50) return "#eab308";
    return "#ef4444";
  }, [elitePercent]);

  const groupedLogs = useMemo(() => {
    const groups: { date: string; label: string; items: TrainingLog[] }[] = [];
    const map = new Map<string, TrainingLog[]>();
    for (const log of logs) {
      const d = log.training_date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(log);
    }
    for (const [date, items] of map) {
      groups.push({ date, label: formatDateLabel(date), items });
    }
    return groups;
  }, [logs]);

  function addExercise() {
    if (!exName.trim()) return;
    setExercises((prev) => [
      ...prev,
      {
        name: exName.trim(),
        sets: parseInt(exSets) || 3,
        reps: parseInt(exReps) || 10,
        load_lbs: exLoad ? parseInt(exLoad) : null,
      },
    ]);
    setExName("");
    setExSets("3");
    setExReps("10");
    setExLoad("");
  }

  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setTitle("");
    setDuration("");
    setCoachName("");
    setExercises([]);
    setExName("");
    setExSets("3");
    setExReps("10");
    setExLoad("");
    setFormError(null);
  }

  async function handleSubmit() {
    if (!selectedType || !duration || !playerId) return;
    const dur = parseInt(duration);
    if (!dur || dur <= 0) {
      setFormError("Enter a valid duration.");
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const payload: Record<string, unknown> = {
      player_id: playerId,
      training_type: selectedType,
      title: title.trim() || null,
      duration_minutes: dur,
      training_date: trainingDate,
      exercises: selectedType === "strength" && exercises.length > 0 ? exercises : null,
      coach_name: selectedType === "individual-session" && coachName.trim() ? coachName.trim() : null,
    };

    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("training_logs")
      .insert(payload)
      .select()
      .single();

    setSubmitting(false);
    if (error) {
      setFormError(error.message || "Failed to save. Try again.");
      return;
    }

    setLogs((prev) => [data as TrainingLog, ...prev]);
    resetForm();
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 1500);
  }

  async function handleDelete(logId: string) {
    const supabase = createClient();
    const { error } = await (supabase as any).from("training_logs").delete().eq("id", logId);
    if (!error) setLogs((prev) => prev.filter((l) => l.id !== logId));
  }

  return (
    <div className={styles.container}>
      {/* Weekly summary */}
      <div className={styles.weeklyCard}>
        <p className={styles.weeklyHours}>
          This Week: <span className={styles.weeklyHoursValue}>{weeklyHours} hrs</span>
        </p>
        <p className={styles.weeklyLabel}>
          Solo sessions and bookings are tracked automatically. Log outside training to measure your Elite Standard.
        </p>
        <p className={styles.eliteLabel}>
          Elite Standard: {weeklyHours} / {eliteTargetHours} hrs
        </p>
        <div className={styles.eliteBar}>
          <div
            className={styles.eliteBarFill}
            style={{ width: `${elitePercent}%`, backgroundColor: eliteBarColor }}
          />
        </div>
      </div>

      {/* Type selector */}
      <div className={styles.typeGrid}>
        {TRAINING_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={`${styles.typeCard} ${selectedType === t.key ? styles.typeCardSelected : ""}`}
              onClick={() => setSelectedType(selectedType === t.key ? null : t.key)}
            >
              <Icon size={22} color={t.color} />
              <span className={styles.typeCardLabel}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Form */}
      {selectedType && (
        <div className={styles.form}>
          <div>
            <label className={styles.formLabel}>Title (optional)</label>
            <input
              className={styles.formInput}
              type="text"
              placeholder={PLACEHOLDERS[selectedType]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.formRow}>
            <div>
              <label className={styles.formLabel}>Duration (min) *</label>
              <input
                className={styles.formInput}
                type="number"
                min={1}
                placeholder="45"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.formLabel}>Date</label>
              <input
                className={styles.formInput}
                type="date"
                value={trainingDate}
                onChange={(e) => setTrainingDate(e.target.value)}
              />
            </div>
          </div>

          {selectedType === "individual-session" && (
            <div>
              <label className={styles.formLabel}>Coach Name</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="e.g. Speed coach Mike"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
              />
            </div>
          )}

          {selectedType === "strength" && (
            <div className={styles.exerciseSection}>
              <label className={styles.formLabel}>Exercises</label>
              <div className={styles.exerciseRow}>
                <div className={styles.exerciseNameCol}>
                  <input
                    className={styles.formInput}
                    type="text"
                    list="exercise-list"
                    placeholder="Exercise name"
                    value={exName}
                    onChange={(e) => setExName(e.target.value)}
                  />
                  <datalist id="exercise-list">
                    {exerciseLibrary.map((ex) => (
                      <option key={ex.id} value={ex.name} />
                    ))}
                  </datalist>
                </div>
                <div className={styles.exerciseNumCol}>
                  <input
                    className={styles.formInput}
                    type="number"
                    min={1}
                    placeholder="Sets"
                    value={exSets}
                    onChange={(e) => setExSets(e.target.value)}
                  />
                </div>
                <div className={styles.exerciseNumCol}>
                  <input
                    className={styles.formInput}
                    type="number"
                    min={1}
                    placeholder="Reps"
                    value={exReps}
                    onChange={(e) => setExReps(e.target.value)}
                  />
                </div>
                <div className={styles.exerciseNumCol}>
                  <input
                    className={styles.formInput}
                    type="number"
                    min={0}
                    placeholder="lbs"
                    value={exLoad}
                    onChange={(e) => setExLoad(e.target.value)}
                  />
                </div>
                <button className={styles.exerciseAddBtn} onClick={addExercise} type="button">
                  <Plus size={14} /> Add
                </button>
              </div>

              {exercises.length > 0 && (
                <div className={styles.exerciseList}>
                  {exercises.map((ex, i) => (
                    <div key={i} className={styles.exerciseItem}>
                      <div className={styles.exerciseItemInfo}>
                        <span className={styles.exerciseItemName}>{ex.name}</span>
                        <span className={styles.exerciseItemMeta}>
                          {ex.sets}×{ex.reps}
                          {ex.load_lbs ? ` @ ${ex.load_lbs} lbs` : ""}
                        </span>
                      </div>
                      <button className={styles.exerciseRemoveBtn} onClick={() => removeExercise(i)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className={`${styles.submitBtn} ${submitSuccess ? styles.submitSuccess : ""}`}
            onClick={handleSubmit}
            disabled={submitting || !duration}
          >
            {submitSuccess ? (
              <><Check size={18} /> Logged!</>
            ) : submitting ? (
              "Saving..."
            ) : (
              "Log Training"
            )}
          </button>
          {formError && <p className={styles.formError}>{formError}</p>}
        </div>
      )}

      {/* History */}
      <div>
        <div className={styles.historyHeader}>
          <span className={styles.historyTitle}>Recent Training</span>
          <span className={styles.historyCount}>{logs.length} log{logs.length !== 1 ? "s" : ""}</span>
        </div>

        {logs.length === 0 ? (
          <p className={styles.emptyHistory}>No training logged yet. Start above!</p>
        ) : (
          groupedLogs.map((group) => (
            <div key={group.date} className={styles.dateGroup}>
              <span className={styles.dateGroupLabel}>{group.label}</span>
              {group.items.map((log) => {
                const typeInfo = TYPE_MAP[log.training_type] || TRAINING_TYPES[0];
                const Icon = typeInfo.icon;
                const hasExercises = log.exercises && log.exercises.length > 0;
                const isExpanded = expandedLogId === log.id;

                return (
                  <div key={log.id} className={styles.logCard}>
                    <div className={styles.logBadge} style={{ background: typeInfo.bg }}>
                      <Icon size={18} color={typeInfo.color} />
                    </div>
                    <div className={styles.logBody}>
                      <div className={styles.logTitle}>
                        {log.title || typeInfo.label}
                      </div>
                      <div className={styles.logMeta}>
                        <span>{log.duration_minutes} min</span>
                        {log.coach_name && <span>w/ {log.coach_name}</span>}
                      </div>
                      {hasExercises && (
                        <div className={styles.logExercises}>
                          <button
                            className={styles.logExerciseToggle}
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            {log.exercises!.length} exercise{log.exercises!.length !== 1 ? "s" : ""}
                            <ChevronDown
                              size={12}
                              style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                            />
                          </button>
                          {isExpanded && (
                            <div className={styles.logExerciseList}>
                              {log.exercises!.map((ex, i) => (
                                <div key={i} className={styles.logExerciseRow}>
                                  <span className={styles.logExerciseRowName}>{ex.name}</span>
                                  <span>{ex.sets}×{ex.reps}{ex.load_lbs ? ` @ ${ex.load_lbs} lbs` : ""}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button className={styles.logDeleteBtn} onClick={() => handleDelete(log.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
