"use client";

import { ArrowLeft } from "lucide-react";
import TrainingTab from "@/app/(player)/player/solo/components/TrainingTab";
import type { ExerciseLibraryItem, TrainingLog } from "@/app/(player)/player/solo/components/TrainingTab";
import styles from "./LogPanel.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseLibrary: ExerciseLibraryItem[];
  recentTrainingLogs: TrainingLog[];
  playerId: string;
  weeklyHgMinutes: number;
  eliteTargetHours: number;
}

export default function LogPanel({
  open,
  onClose,
  exerciseLibrary,
  recentTrainingLogs,
  playerId,
  weeklyHgMinutes,
  eliteTargetHours,
}: Props) {
  return (
    <div className={`${styles.overlay} ${open ? styles.overlayOpen : ""}`}>
      <div className={`${styles.panel} ${open ? styles.panelOpen : ""}`}>
        <button className={styles.backBtn} onClick={onClose} type="button">
          <ArrowLeft size={22} />
        </button>
        <div className={styles.content}>
          <TrainingTab
            exerciseLibrary={exerciseLibrary}
            recentTrainingLogs={recentTrainingLogs}
            playerId={playerId}
            weeklyHgMinutes={weeklyHgMinutes}
            eliteTargetHours={eliteTargetHours}
          />
        </div>
      </div>
    </div>
  );
}
