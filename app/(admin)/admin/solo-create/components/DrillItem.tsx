"use client";

import React from "react";
import { X, GripVertical, Pencil, Copy } from "lucide-react";
import { formatLabel } from "@/lib/curriculum";
import styles from "../solo-create.module.css";

export interface DrillData {
  video_id: string;
  name: string;
  path: string;
  section?: string;
  skill?: string;
  sub_skill?: string;
  coaching_points?: string;
  rest_time?: number;
  reps?: number;
  sets?: number;
  set_number?: number;
  phase?: string;
  tagged_skills?: string[];
}

interface Props {
  drill: DrillData;
  index: number;
  hideParams?: boolean;
  singleSlot?: boolean;
  showTacticalMeta?: boolean;
  onRemove: () => void;
  onParamChange: (field: string, value: number | null) => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (index: number) => void;
  dragOverIndex?: number | null;
}

export default function DrillItem({
  drill, index, hideParams, singleSlot, showTacticalMeta,
  onRemove, onParamChange, onEdit, onDuplicate,
  onDragStart, onDragOver, onDrop, dragOverIndex,
}: Props) {
  const showDragHandle = !singleSlot && !!onDragStart;
  const showDuplicate = !singleSlot && !!onDuplicate;
  const isDragTarget = dragOverIndex === index;

  return (
    <div
      className={`${styles.drillItem} ${isDragTarget ? styles.drillItemDragOver : ""}`}
      draggable={showDragHandle}
      onDragStart={(e) => {
        if (showDragHandle) {
          e.dataTransfer.effectAllowed = "move";
          onDragStart!(index);
        }
      }}
      onDragOver={(e) => {
        if (onDragOver) {
          e.preventDefault();
          onDragOver(e, index);
        }
      }}
      onDrop={() => onDrop?.(index)}
      onDragEnd={() => onDrop?.(index)}
    >
      <div className={styles.drillHeader}>
        <div className={styles.drillLeft}>
          {showDragHandle && (
            <span className={styles.dragHandle} aria-label="Drag to reorder">
              <GripVertical size={16} />
            </span>
          )}
          <div className={styles.drillInfo}>
            <span className={styles.drillName}>{drill.name}</span>
            <span className={styles.drillPath}>{drill.path}</span>
            {drill.coaching_points && (
              <span className={styles.drillCoaching}>{drill.coaching_points}</span>
            )}
            {showTacticalMeta && (drill.phase || (drill.tagged_skills && drill.tagged_skills.length > 0)) && (
              <span className={styles.drillTacticalMeta}>
                {drill.phase ? `Phase: ${formatLabel(drill.phase)}` : ""}
                {drill.phase && drill.tagged_skills && drill.tagged_skills.length > 0 ? " | " : ""}
                {drill.tagged_skills && drill.tagged_skills.length > 0
                  ? `Skills: ${drill.tagged_skills.map(formatLabel).join(", ")}`
                  : ""}
              </span>
            )}
          </div>
        </div>
        <div className={styles.drillActions}>
          {showDuplicate && (
            <button className={styles.drillActionBtn} onClick={onDuplicate} type="button" aria-label="Duplicate drill" title="Duplicate">
              <Copy size={14} />
            </button>
          )}
          {onEdit && (
            <button className={styles.drillActionBtn} onClick={onEdit} type="button" aria-label="Edit drill" title="Edit">
              <Pencil size={14} />
            </button>
          )}
          <button className={styles.drillRemove} onClick={onRemove} type="button" aria-label="Remove drill">
            <X size={16} />
          </button>
        </div>
      </div>
      {!hideParams && (
        <div className={styles.drillParams}>
          <label className={styles.drillParam}>
            <span>Rest (min)</span>
            <input
              type="number"
              step={0.5}
              min={0}
              value={drill.rest_time ?? ""}
              onChange={(e) => onParamChange("rest_time", e.target.value ? parseFloat(e.target.value) : null)}
            />
          </label>
          <label className={styles.drillParam}>
            <span>Reps</span>
            <input
              type="number"
              min={1}
              value={drill.reps ?? ""}
              onChange={(e) => onParamChange("reps", e.target.value ? parseInt(e.target.value) : null)}
            />
          </label>
          <label className={styles.drillParam}>
            <span>Sets</span>
            <input
              type="number"
              min={1}
              value={drill.sets ?? ""}
              onChange={(e) => onParamChange("sets", e.target.value ? parseInt(e.target.value) : null)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
