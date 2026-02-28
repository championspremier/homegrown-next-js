"use client";

import { useState } from "react";
import { ListChecks, Image as ImageIcon } from "lucide-react";
import CategorySelection from "./components/CategorySelection";
import SessionForm from "./components/SessionForm";
import EditSessions from "./components/EditSessions";
import ThumbnailManager from "./components/ThumbnailManager";
import styles from "./solo-create.module.css";

export type Category = "technical" | "tactical" | "physical" | "mental";

export interface SoloSession {
  id: string;
  category: string;
  period: string;
  skill: string | null;
  sub_skill: string | null;
  difficulty_level: string;
  warm_up_video_id: string | null;
  finishing_or_passing_video_id: string | null;
  main_exercises: Array<{
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
    order?: number;
    phase?: string;
    tagged_skills?: string[];
  }>;
  coach_id: string | null;
  is_active: boolean;
  title: string | null;
  description?: string | null;
  created_at: string;
}

export interface SoloVideo {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  period: string;
  category: string;
  skill: string | null;
  sub_skill: string | null;
  title: string | null;
  description: string | null;
  difficulty_level: string | null;
  created_at: string;
}

export interface SkillThumbnail {
  id: string;
  category: string;
  skill: string | null;
  sub_skill: string | null;
  period: string;
  thumbnail_url: string;
}

interface SoloCreateClientProps {
  sessions: SoloSession[];
  videos: SoloVideo[];
  thumbnails: SkillThumbnail[];
}

type View = "categories" | "create" | "edit-list" | "thumbnails";

export default function SoloCreateClient({ sessions: initialSessions, videos: initialVideos, thumbnails: initialThumbnails }: SoloCreateClientProps) {
  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [videos, setVideos] = useState(initialVideos);
  const [sessions, setSessions] = useState(initialSessions);
  const [editSession, setEditSession] = useState<SoloSession | null>(null);
  const [thumbnails, setThumbnails] = useState(initialThumbnails);

  function handleCategorySelect(category: Category) {
    setSelectedCategory(category);
    setEditSession(null);
    setView("create");
  }

  function handleVideoUploaded(video: SoloVideo) {
    setVideos((prev) => [video, ...prev]);
  }

  function handleEditSession(session: SoloSession) {
    setEditSession(session);
    setSelectedCategory(session.category as Category);
    setView("create");
  }

  function handleSessionDeleted(sessionId: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  function handleThumbnailSaved(thumb: SkillThumbnail) {
    setThumbnails((prev) => {
      const idx = prev.findIndex((t) => t.id === thumb.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = thumb;
        return updated;
      }
      return [thumb, ...prev];
    });
  }

  function handleSessionSaved(session: SoloSession) {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = session;
        return updated;
      }
      return [session, ...prev];
    });
    setEditSession(null);
    setView("categories");
    setSelectedCategory(null);
  }

  const breadcrumbSegment = (() => {
    if (view === "create" && selectedCategory) {
      return selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
    }
    if (view === "edit-list") return "Edit Sessions";
    if (view === "thumbnails") return "Thumbnails";
    return null;
  })();

  return (
    <div className={styles.container}>
      {breadcrumbSegment && (
        <nav className={styles.breadcrumb}>
          <button
            className={styles.breadcrumbLink}
            onClick={() => { setView("categories"); setSelectedCategory(null); setEditSession(null); }}
            type="button"
          >
            Solo Create
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{breadcrumbSegment}</span>
        </nav>
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Solo Create</h1>
          <p className={styles.subtitle}>Build and manage solo training sessions</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${view === "edit-list" ? styles.actionBtnActive : ""}`}
            onClick={() => setView(view === "edit-list" ? "categories" : "edit-list")}
            type="button"
          >
            <ListChecks size={18} />
            <span>Edit Sessions</span>
            {sessions.length > 0 && <span className={styles.badge}>{sessions.length}</span>}
          </button>
          <button
            className={`${styles.actionBtn} ${view === "thumbnails" ? styles.actionBtnActive : ""}`}
            onClick={() => setView(view === "thumbnails" ? "categories" : "thumbnails")}
            type="button"
          >
            <ImageIcon size={18} />
            <span>Manage Thumbnails</span>
          </button>
        </div>
      </div>

      {view === "categories" && (
        <CategorySelection onSelect={handleCategorySelect} />
      )}

      {view === "create" && selectedCategory && (
        <SessionForm
          key={editSession?.id || selectedCategory}
          category={selectedCategory}
          videos={videos}
          editSession={editSession}
          onBack={() => { setView(editSession ? "edit-list" : "categories"); setSelectedCategory(null); setEditSession(null); }}
          onVideoUploaded={handleVideoUploaded}
          onSessionSaved={handleSessionSaved}
        />
      )}

      {view === "edit-list" && (
        <EditSessions
          sessions={sessions}
          videos={videos}
          onBack={() => setView("categories")}
          onEdit={handleEditSession}
          onDeleted={handleSessionDeleted}
        />
      )}

      {view === "thumbnails" && (
        <ThumbnailManager
          thumbnails={thumbnails}
          onBack={() => setView("categories")}
          onSaved={handleThumbnailSaved}
        />
      )}
    </div>
  );
}
