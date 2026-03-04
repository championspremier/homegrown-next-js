"use client";

import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import ActivityGrid from "./components/ActivityGrid";
import LogPanel from "./components/LogPanel";
import PillarTabs from "./components/PillarTabs";
import type { ExerciseLibraryItem, TrainingLog } from "@/app/(player)/player/solo/components/TrainingTab";
import styles from "./tracking.module.css";

interface Axis {
  key: string;
  label: string;
  coachOnly: boolean;
}

interface PillarData {
  axes: Axis[];
  scores: Record<string, number | null>;
}

interface PointsData {
  total: number;
  position: number | null;
  quarterLabel: string;
  history: { checked_in_at: string; session_type: string; points: number }[];
}

interface Props {
  playerId: string;
  leaderboardPosition: number;
  quarterPoints: number;
  activityData: { date: string; count: number; types: string[] }[];
  exerciseLibrary: ExerciseLibraryItem[];
  recentTrainingLogs: unknown[];
  weeklyHgMinutes: number;
  eliteTargetHours: number;
  spiderData: Record<string, PillarData>;
  pointsData: PointsData;
  quizHistory: unknown[];
  activeObjectives: unknown;
  pastObjectives: unknown[];
}

export default function TrackingClient({
  playerId,
  leaderboardPosition,
  activityData,
  exerciseLibrary,
  recentTrainingLogs,
  weeklyHgMinutes,
  eliteTargetHours,
  spiderData,
  pointsData,
  quizHistory,
  activeObjectives,
  pastObjectives,
}: Props) {
  const [logOpen, setLogOpen] = useState(false);

  const weeklyTotalHours = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + diffToMon);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    let manualMin = 0;
    for (const log of (recentTrainingLogs as TrainingLog[])) {
      const d = new Date(log.training_date + "T00:00:00");
      if (d >= start && d <= end) manualMin += log.duration_minutes;
    }
    return parseFloat(((manualMin + weeklyHgMinutes) / 60).toFixed(1));
  }, [recentTrainingLogs, weeklyHgMinutes]);

  return (
    <div className={styles.page}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.lbBadgeWrap}>
          <div className={styles.lbBadge}>
            <span className={styles.lbPosition}>
              {leaderboardPosition > 0 ? `#${leaderboardPosition}` : "—"}
            </span>
          </div>
          <span className={styles.lbLabel}>Leaderboard</span>
        </div>

        <button className={styles.logBtn} onClick={() => setLogOpen(true)} type="button">
          <Plus size={16} />
          Log
        </button>
      </div>

      {/* Activity grid */}
      <ActivityGrid
        activityData={activityData}
        eliteTargetHours={eliteTargetHours}
        weeklyTotalHours={weeklyTotalHours}
      />

      {/* Pillar cards, spider chart, legend, sub-tabs */}
      <PillarTabs
        spiderData={spiderData}
        pointsData={pointsData}
        quizHistory={quizHistory}
        activeObjectives={activeObjectives}
        pastObjectives={pastObjectives}
      />

      {/* Log panel */}
      <LogPanel
        open={logOpen}
        onClose={() => setLogOpen(false)}
        exerciseLibrary={exerciseLibrary}
        recentTrainingLogs={recentTrainingLogs as TrainingLog[]}
        playerId={playerId}
        weeklyHgMinutes={weeklyHgMinutes}
        eliteTargetHours={eliteTargetHours}
      />
    </div>
  );
}
