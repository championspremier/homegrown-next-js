"use client";

import { CircleDot, Map, Dumbbell, Brain } from "lucide-react";
import styles from "../solo-create.module.css";
import type { Category } from "../solo-create-client";

interface Props {
  onSelect: (category: Category) => void;
}

const CATEGORIES: { key: Category; icon: React.ReactNode; title: string; description: string }[] = [
  { key: "technical", icon: <CircleDot size={32} />, title: "Technical", description: "Ball work, first touch, passing, finishing" },
  { key: "tactical", icon: <Map size={32} />, title: "Tactical", description: "Game understanding, phases of play" },
  { key: "physical", icon: <Dumbbell size={32} />, title: "Physical", description: "Conditioning, strength, mobility" },
  { key: "mental", icon: <Brain size={32} />, title: "Mental", description: "Meditation, prayer, breathing, mindset" },
];

export default function CategorySelection({ onSelect }: Props) {
  return (
    <>
      <div className={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={styles.categoryCard}
            onClick={() => onSelect(cat.key)}
            type="button"
          >
            <span className={styles.categoryIcon}>{cat.icon}</span>
            <span className={styles.categoryTitle}>{cat.title}</span>
            <span className={styles.categoryDesc}>{cat.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.sessionPreview}>
        <div className={styles.sessionPreviewHeader}>
          <h3 className={styles.sessionPreviewTitle}>Session Preview</h3>
          <p className={styles.sessionPreviewSubtitle}>Live preview of how the session will appear to players</p>
        </div>
        <div className={styles.phoneMockup}>
          <div className={styles.phoneMockupEmpty}>
            Select a category to start building
          </div>
        </div>
      </div>
    </>
  );
}
