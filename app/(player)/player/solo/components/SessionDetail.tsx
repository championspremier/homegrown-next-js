"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Play,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Repeat,
  Layers,
  BarChart3,
  ListOrdered,
  Crosshair,
  Dumbbell,
  Brain,
  Maximize2,
  CheckCircle2,
  Camera,
  Upload,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatLabel } from "@/lib/curriculum";
import { getPeriodLabel } from "@/lib/curriculum-period";
import { getCurrentQuarter, getSessionType } from "@/lib/points";
import styles from "./SessionDetail.module.css";

interface DrillData {
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
}

interface SessionData {
  id: string;
  category: string;
  period: string;
  skill: string | null;
  sub_skill: string | null;
  difficulty_level: string;
  warm_up_video_id: string | null;
  finishing_or_passing_video_id: string | null;
  main_exercises: DrillData[];
  is_active: boolean;
  title: string | null;
  description?: string | null;
}

interface VideoRecord {
  id: string;
  video_url: string;
  title: string | null;
  description: string | null;
  orientation?: string | null;
}

interface Props {
  session: SessionData;
  onBack: () => void;
  playerId: string;
}

interface BookingData {
  id: string;
  player_id: string;
  solo_session_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  completion_photo_url: string | null;
  status: "scheduled" | "pending_review" | "checked-in" | "denied" | "cancelled";
  checked_in_at: string | null;
}

type SheetLevel = 0 | 1 | 2;

const OVAL_HEIGHT = 56;

const CATEGORY_GRADIENTS: Record<string, string> = {
  technical: "linear-gradient(135deg, #1e3a5f, #2d5a87)",
  physical: "linear-gradient(135deg, #1e5f3a, #2d8757)",
  mental: "linear-gradient(135deg, #5f1e5f, #872d87)",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  technical: Crosshair,
  physical: Dumbbell,
  mental: Brain,
};

function calculateDuration(exercises: DrillData[]): number {
  if (exercises.length === 0) return 0;
  let totalSeconds = 0;
  for (const d of exercises) {
    const reps = d.reps || 1;
    const sets = d.sets || 1;
    const restMin = d.rest_time || 0;
    const activeTime = reps * sets * 5;
    const restTime = restMin * 60 * (sets > 1 ? sets - 1 : 0);
    totalSeconds += activeTime + restTime + 30;
  }
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

export default function SessionDetail({ session, onBack, playerId }: Props) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const [sheetLevel, setSheetLevel] = useState<SheetLevel>(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [coachingModal, setCoachingModal] = useState<string | null>(null);
  const [videoMap, setVideoMap] = useState<Map<string, VideoRecord>>(new Map());
  const [videoFailed, setVideoFailed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isMainLandscape, setIsMainLandscape] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [landscapeDrillIds, setLandscapeDrillIds] = useState<Set<string>>(new Set());
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [schedLoading, setSchedLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedTime, setSelectedTime] = useState(() => {
    const h = new Date().getHours() + 1;
    return `${String(h % 24).padStart(2, "0")}:00`;
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completedToday, setCompletedToday] = useState(false);
  const [completionCount, setCompletionCount] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartPx = useRef(0);
  const videoFallbackIndex = useRef(0);

  const allExercises = session.main_exercises || [];
  const hasSectionTags = allExercises.some((d) => d.section);

  // New format: split by section tag. Legacy fallback: use UUID columns.
  const warmupDrills: DrillData[] = hasSectionTags
    ? allExercises.filter((d) => d.section === "warmup")
    : (() => {
        const id = session.warm_up_video_id;
        if (!id) return [];
        const found = allExercises.find((d) => d.video_id === id);
        if (found) return [found];
        const rec = videoMap.get(id);
        if (rec) return [{ video_id: id, name: rec.title || "Warm-Up", path: rec.video_url?.startsWith("http") ? "" : (rec.video_url || "") }];
        return [];
      })();

  const mainDrills: DrillData[] = hasSectionTags
    ? allExercises.filter((d) => d.section === "main" || !d.section)
    : allExercises.filter((d) => d.video_id !== session.warm_up_video_id && d.video_id !== session.finishing_or_passing_video_id);

  const finishingDrills: DrillData[] = hasSectionTags
    ? allExercises.filter((d) => d.section === "finishing")
    : (() => {
        const id = session.finishing_or_passing_video_id;
        if (!id) return [];
        const found = allExercises.find((d) => d.video_id === id);
        if (found) return [found];
        const rec = videoMap.get(id);
        if (rec) return [{ video_id: id, name: rec.title || "Finishing", path: rec.video_url?.startsWith("http") ? "" : (rec.video_url || "") }];
        return [];
      })();

  const drillCount = warmupDrills.length + mainDrills.length + finishingDrills.length;
  const estMin = calculateDuration(allExercises);

  /* ── Video URL helpers ── */
  const resolveVideoUrl = useCallback(
    (path: string): string => {
      if (path.startsWith("http://") || path.startsWith("https://")) return path;
      return `${supabaseUrl}/storage/v1/object/public/solo-session-videos/${path}`;
    },
    [supabaseUrl]
  );

  const videoFallbacks = useCallback((): string[] => {
    const urls: string[] = [];
    const tryAdd = (drill: DrillData) => {
      if (drill.path) { urls.push(resolveVideoUrl(drill.path)); return; }
      const rec = videoMap.get(drill.video_id);
      if (rec?.video_url) urls.push(resolveVideoUrl(rec.video_url));
    };
    // Priority: main first (most relevant), then warmup, then finishing
    for (const d of mainDrills) tryAdd(d);
    for (const d of warmupDrills) tryAdd(d);
    for (const d of finishingDrills) tryAdd(d);
    return urls;
  }, [mainDrills, warmupDrills, finishingDrills, resolveVideoUrl, videoMap]);

  useEffect(() => {
    const urls = videoFallbacks();
    if (urls.length > 0 && !activeVideoUrl) {
      videoFallbackIndex.current = 0;
      setActiveVideoUrl(urls[0]);
      setVideoFailed(false);
    }
  }, [videoFallbacks, activeVideoUrl]);

  function handleVideoError() {
    const urls = videoFallbacks();
    const nextIdx = videoFallbackIndex.current + 1;
    if (nextIdx < urls.length) {
      videoFallbackIndex.current = nextIdx;
      setActiveVideoUrl(urls[nextIdx]);
    } else {
      setVideoFailed(true);
    }
  }

  /* ── Snap height calculation ── */
  function getSnapHeights(): [number, number, number] {
    const h = containerRef.current?.clientHeight || window.innerHeight;
    const isMobile = window.innerWidth < 768;
    const expandedRatio = isMobile ? 0.75 : 0.85;
    return [OVAL_HEIGHT, h * 0.45, h * expandedRatio];
  }

  const [snapHeights, setSnapHeights] = useState<[number, number, number]>([
    OVAL_HEIGHT,
    typeof window !== "undefined" ? window.innerHeight * 0.45 : 360,
    typeof window !== "undefined"
      ? window.innerHeight * (window.innerWidth < 768 ? 0.75 : 0.85)
      : 680,
  ]);

  useEffect(() => {
    function recalc() { setSnapHeights(getSnapHeights()); }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  /* ── Fetch video records for all drills ── */
  useEffect(() => {
    const idSet = new Set<string>();
    for (const d of allExercises) { if (d.video_id) idSet.add(d.video_id); }
    // Legacy: also include the dedicated UUID columns if present
    if (session.warm_up_video_id) idSet.add(session.warm_up_video_id);
    if (session.finishing_or_passing_video_id) idSet.add(session.finishing_or_passing_video_id);
    const ids = Array.from(idSet);
    if (ids.length === 0) return;
    const supabase = createClient();
    (supabase as any)
      .from("solo_session_videos")
      .select("id,video_url,title,description,orientation")
      .in("id", ids)
      .then(({ data }: { data: VideoRecord[] | null }) => {
        if (!data) return;
        const m = new Map<string, VideoRecord>();
        for (const v of data) m.set(v.id, v);
        setVideoMap(m);
      });
  }, [session.id]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const parentId = authUserId && authUserId !== playerId ? authUserId : null;

  /* ── Fetch auth user for storage + check prior completion ── */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setAuthUserId(data.user.id);
    });

    const today = new Date().toISOString().split("T")[0];
    (supabase as any)
      .from("player_curriculum_progress")
      .select("id,completed_at,points_earned")
      .eq("player_id", playerId)
      .eq("session_id", session.id)
      .is("video_id", null)
      .order("completed_at", { ascending: false })
      .then(({ data: rows }: { data: { id: string; completed_at: string; points_earned: number }[] | null }) => {
        const completions = rows || [];
        setCompletionCount(completions.length);
        setCompletedToday(completions.some((c) => c.completed_at?.startsWith(today)));
      });
  }, [session.id, playerId]);

  const getVideoUrl = useCallback(
    (drill: DrillData): string | null => {
      if (drill.path) return resolveVideoUrl(drill.path);
      const rec = videoMap.get(drill.video_id);
      if (rec?.video_url) return resolveVideoUrl(rec.video_url);
      return null;
    },
    [videoMap, resolveVideoUrl]
  );

  function playDrill(drill: DrillData) {
    const url = getVideoUrl(drill);
    if (!url) return;
    videoFallbackIndex.current = 0;
    setActiveVideoUrl(url);
    setIsPlaying(true);
    setVideoFailed(false);
    setTimeout(() => videoRef.current?.play().catch(() => {}), 100);
  }

  function toggleMainVideo() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function toggleSection(key: string) {
    setExpandedSection((prev) => (prev === key ? null : key));
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  }

  /* ── Session completion ── */
  async function handleComplete() {
    if (!playerId || completedToday || isCompleting) return;
    setIsCompleting(true);

    const supabase = createClient();
    const pointsValue = 1.0;
    const sessionType = getSessionType(session.category, session.skill);
    const { year, quarter } = getCurrentQuarter();
    const now = new Date().toISOString();

    const { error: progressError } = await (supabase as any)
      .from("player_curriculum_progress")
      .insert({
        player_id: playerId,
        period: session.period,
        category: session.category,
        skill: session.skill || null,
        sub_skill: session.sub_skill || null,
        session_type: "solo",
        session_id: session.id,
        video_id: null,
        points_earned: pointsValue,
        completed_at: now,
      });

    if (progressError) {
      setIsCompleting(false);
      if (progressError.code === "23505") {
        showToast("Already completed today! Come back tomorrow.");
        setCompletedToday(true);
      } else {
        showToast("Error saving progress. Try again.");
        console.error("[complete] progress insert error:", progressError);
      }
      return;
    }

    let pointsAwarded = false;
    try {
      const { error: pointsError } = await (supabase as any)
        .from("points_transactions")
        .insert({
          player_id: playerId,
          points: pointsValue,
          session_type: sessionType,
          session_id: session.id,
          quarter_year: year,
          quarter_number: quarter,
          status: "active",
          checked_in_at: now,
        });
      if (!pointsError) pointsAwarded = true;
      else console.warn("[complete] points not awarded (non-blocking):", pointsError.message);
    } catch (e) {
      console.warn("[complete] points insert failed (non-blocking):", e);
    }

    setIsCompleting(false);
    setCompletedToday(true);
    setCompletionCount((c) => c + 1);
    setEarnedPoints(pointsAwarded ? pointsValue : 0);
    setShowCelebration(true);
  }

  /* ── Schedule modal ── */
  async function openScheduleModal() {
    if (!playerId) return;
    setSchedLoading(true);
    setShowScheduleModal(true);

    const supabase = createClient();
    const { data: existing } = await (supabase as any)
      .from("player_solo_session_bookings")
      .select("*")
      .eq("player_id", playerId)
      .eq("solo_session_id", session.id)
      .in("status", ["scheduled", "pending_review", "checked-in", "denied"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) setBooking(existing as BookingData);
    else setBooking(null);
    setSchedLoading(false);
  }

  async function handleSchedule() {
    if (!playerId) return;
    setSchedLoading(true);
    const supabase = createClient();

    const { data: existing } = await (supabase as any)
      .from("player_solo_session_bookings")
      .select("id, solo_session:solo_sessions(skill)")
      .eq("player_id", playerId)
      .eq("scheduled_date", selectedDate)
      .in("status", ["scheduled", "completed", "pending_review", "checked-in"]);

    const sameSkill = (existing as any[])?.some(
      (b: any) => b.solo_session?.skill === session.skill
    );
    if (sameSkill) {
      showToast("One session per skill per day.");
      setSchedLoading(false);
      return;
    }

    const { data: newBooking, error } = await (supabase as any)
      .from("player_solo_session_bookings")
      .insert({
        player_id: playerId,
        parent_id: parentId,
        solo_session_id: session.id,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) {
      showToast("Could not schedule. Try again.");
      console.error("[schedule]", error);
    } else {
      setBooking(newBooking as BookingData);
      showToast("Session scheduled!");
    }
    setSchedLoading(false);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handlePhotoUpload() {
    if (!photoFile || !booking || !playerId) return;
    setIsUploading(true);
    const supabase = createClient();

    const fileExt = photoFile.name.split(".").pop() || "jpg";
    const storageOwner = authUserId || playerId;
    const filePath = `${storageOwner}/${booking.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("solo-session-photos")
      .upload(filePath, photoFile, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      showToast("Upload failed. Try again.");
      console.error("[photo upload]", uploadError);
      setIsUploading(false);
      return;
    }

    const { data: pubData } = supabase.storage
      .from("solo-session-photos")
      .getPublicUrl(filePath);

    const publicUrl = pubData?.publicUrl || "";

    await (supabase as any)
      .from("player_solo_session_bookings")
      .update({ completion_photo_url: publicUrl, status: "pending_review" })
      .eq("id", booking.id);

    setBooking({ ...booking, completion_photo_url: publicUrl, status: "pending_review" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsUploading(false);
    showToast("Photo uploaded! Waiting for coach review.");

    // Notify coaches
    const { data: coaches } = await (supabase as any)
      .from("profiles")
      .select("id")
      .in("role", ["coach", "admin"]);
    const { data: player } = await (supabase as any)
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", playerId)
      .single();

    if (coaches?.length && player) {
      const playerName = `${player.first_name || ""} ${player.last_name || ""}`.trim();
      const skillName = session.skill
        ? session.skill.split("-").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")
        : session.title || "Solo Session";
      const notifications = (coaches as { id: string }[]).map((c) => ({
        user_id: c.id,
        type: "solo_photo_review",
        title: "Solo Session Photo Review",
        message: `${playerName} uploaded a photo for ${skillName}. Review and check in.`,
        data: { booking_id: booking.id, player_id: playerId, session_id: session.id },
        read: false,
      }));
      await (supabase as any).from("notifications").insert(notifications);
    }
  }

  async function handleCancelBooking() {
    if (!booking) return;
    const supabase = createClient();
    await (supabase as any)
      .from("player_solo_session_bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    setBooking(null);
    showToast("Session cancelled.");
  }

  /* ── Landscape detection ── */
  function handleMainVideoMetadata() {
    const v = videoRef.current;
    if (v) setIsMainLandscape(v.videoWidth > v.videoHeight);
  }

  function handleDrillThumbMetadata(drillId: string, e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (v.videoWidth > v.videoHeight) {
      setLandscapeDrillIds((prev) => {
        const next = new Set(prev);
        next.add(drillId);
        return next;
      });
    }
  }

  /* ── Fullscreen for landscape videos ── */
  function handleFullscreen(videoEl: HTMLVideoElement | null, url: string) {
    const isMobile = window.innerWidth < 768;
    if (isMobile && videoEl) {
      if (videoEl.requestFullscreen) {
        videoEl.requestFullscreen().then(() => {
          try { (screen.orientation as any).lock("landscape").catch(() => {}); } catch {}
        }).catch(() => {});
      } else if ((videoEl as any).webkitEnterFullscreen) {
        (videoEl as any).webkitEnterFullscreen();
      }
    } else {
      setLightboxUrl(url);
    }
  }

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) {
        try { (screen.orientation as any).unlock?.(); } catch {}
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* ── Drag handling — Level 1 & 2 only, oval is click-only ── */
  function handleDragStart(e: React.TouchEvent | React.MouseEvent) {
    if (sheetLevel === 0) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = y;
    dragStartPx.current = snapHeights[sheetLevel];
  }

  function handleDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (dragStartY.current === 0) return;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    const delta = dragStartY.current - y;
    const maxH = snapHeights[2];
    const newH = Math.max(OVAL_HEIGHT, Math.min(maxH, dragStartPx.current + delta));
    if (sheetRef.current) {
      sheetRef.current.style.height = `${newH}px`;
      sheetRef.current.style.transition = "none";
    }
  }

  function handleDragEnd() {
    if (dragStartY.current === 0) return;
    dragStartY.current = 0;
    if (!sheetRef.current) return;
    const currentH = sheetRef.current.getBoundingClientRect().height;
    let closest: SheetLevel = 0;
    let minDist = Infinity;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(currentH - snapHeights[i]);
      if (d < minDist) { minDist = d; closest = i as SheetLevel; }
    }
    setSheetLevel(closest);
    sheetRef.current.style.height = "";
    sheetRef.current.style.transition = "";
  }

  /* ── Sections by category ── */
  function buildSections(): { key: string; label: string; drills: DrillData[] }[] {
    const sections: { key: string; label: string; drills: DrillData[] }[] = [];

    if (warmupDrills.length > 0) {
      sections.push({ key: "warmup", label: "Warm-Up", drills: warmupDrills });
    }

    if (session.category === "physical") {
      const setMap = new Map<number, DrillData[]>();
      for (const d of mainDrills) {
        const sn = d.set_number ?? 1;
        if (!setMap.has(sn)) setMap.set(sn, []);
        setMap.get(sn)!.push(d);
      }
      const sortedSets = Array.from(setMap.entries()).sort((a, b) => a[0] - b[0]);
      for (const [setNum, drills] of sortedSets) {
        sections.push({ key: `set-${setNum}`, label: `Set ${setNum}`, drills });
      }
    } else if (session.category === "mental") {
      if (mainDrills.length > 0) {
        sections.push({ key: "main", label: "Exercises", drills: mainDrills });
      }
    } else {
      if (mainDrills.length > 0) {
        sections.push({ key: "main", label: "Main Exercises", drills: mainDrills });
      }
    }

    if (finishingDrills.length > 0) {
      sections.push({ key: "finishing", label: "Finishing / Passing", drills: finishingDrills });
    }

    return sections;
  }

  const sections = buildSections();
  const isOval = sheetLevel === 0;
  const gradient = CATEGORY_GRADIENTS[session.category] || CATEGORY_GRADIENTS.technical;
  const FallbackIcon = CATEGORY_ICONS[session.category] || Crosshair;

  return (
    <div className={styles.overlay} ref={containerRef}>
      {/* ── Video background ── */}
      <div className={styles.videoBg}>
        {activeVideoUrl && !videoFailed ? (
          <video
            ref={videoRef}
            className={styles.video}
            src={activeVideoUrl}
            playsInline
            muted
            preload="metadata"
            onClick={toggleMainVideo}
            onLoadedMetadata={handleMainVideoMetadata}
            onError={handleVideoError}
          />
        ) : (
          <div className={styles.videoGradientFallback} style={{ background: gradient }}>
            <FallbackIcon size={48} strokeWidth={1.5} />
            <span className={styles.fallbackTitle}>
              {session.title || `${formatLabel(session.category)} Session`}
            </span>
          </div>
        )}

        {!isPlaying && !videoFailed && activeVideoUrl && (
          <button className={styles.glassPlay} onClick={toggleMainVideo}>
            <Play size={36} fill="#fff" />
          </button>
        )}

        {isMainLandscape && activeVideoUrl && !videoFailed && (
          <button
            className={styles.fullscreenBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleFullscreen(videoRef.current, activeVideoUrl);
            }}
          >
            <Maximize2 size={20} />
          </button>
        )}

        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={20} />
        </button>

        <button
          className={styles.addScheduleBtn}
          onClick={openScheduleModal}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* ── Bottom sheet ── */}
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${isOval ? styles.sheetOval : styles.sheetExpanded}`}
        style={{ height: `${snapHeights[sheetLevel]}px` }}
      >
        {/* ── Level 0: Pill (click-only, no drag) ── */}
        {isOval && (
          <div
            className={styles.ovalPill}
            onClick={() => setSheetLevel(1)}
          >
            <div className={styles.ovalHandleBar} />
            <div className={styles.ovalMeta}>
              <span className={styles.ovalItem}>
                <BarChart3 size={14} /> {formatLabel(session.difficulty_level)}
              </span>
              <span className={styles.ovalItem}>
                <Clock size={14} /> {estMin} min
              </span>
              <span className={styles.ovalItem}>
                <ListOrdered size={14} /> {drillCount} drill{drillCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* ── Level 1+: Full content ── */}
        {!isOval && (
          <>
            <div
              className={styles.sheetHandle}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
            >
              <div className={styles.sheetHandleBar} />
            </div>

            <button
              className={styles.sheetClose}
              onClick={() => setSheetLevel(0)}
            >
              <X size={18} />
            </button>

            <div className={styles.sheetMeta}>
              <span className={styles.sheetMetaPill} style={{ background: "var(--accent-solid)", color: "#fff" }}>
                {formatLabel(session.difficulty_level)}
              </span>
              <span className={styles.sheetMetaPill}>
                <Clock size={12} /> {estMin} min
              </span>
              <span className={styles.sheetMetaPill}>
                {drillCount} drill{drillCount !== 1 ? "s" : ""}
              </span>
              <span className={styles.sheetMetaPill}>
                {getPeriodLabel(session.period)}
              </span>
            </div>

            <div className={styles.sheetContent}>
              <h2 className={styles.sheetTitle}>
                {session.title || `${formatLabel(session.category)} Session`}
              </h2>

              {session.description && (
                <p className={styles.sheetDesc}>{session.description}</p>
              )}

              {sections.map((sec) => {
                const isOpen = expandedSection === sec.key;
                return (
                  <div key={sec.key} className={styles.drillSection}>
                    <button
                      className={styles.sectionHeader}
                      onClick={() => toggleSection(sec.key)}
                    >
                      <span className={styles.sectionLabel}>
                        {sec.label}
                        <span className={styles.sectionCount}>{sec.drills.length}</span>
                      </span>
                      {isOpen ? (
                        <ChevronUp size={18} className={styles.sectionChevron} />
                      ) : (
                        <ChevronDown size={18} className={styles.sectionChevron} />
                      )}
                    </button>

                    {isOpen && (
                      <div className={styles.sectionBody}>
                        {sec.drills.map((drill, i) => {
                          const thumbUrl = getVideoUrl(drill);
                          const drillKey = `${drill.video_id}-${i}`;
                          const isDrillLandscape = landscapeDrillIds.has(drillKey);
                          return (
                            <div key={drillKey} className={styles.drillItem}>
                              <div
                                className={styles.drillThumb}
                                onClick={() => playDrill(drill)}
                              >
                                {thumbUrl ? (
                                  <video
                                    className={styles.drillThumbVideo}
                                    src={thumbUrl}
                                    preload="metadata"
                                    muted
                                    playsInline
                                    onLoadedMetadata={(e) => handleDrillThumbMetadata(drillKey, e)}
                                  />
                                ) : (
                                  <div className={styles.drillThumbPlaceholder} />
                                )}
                                <div className={styles.drillThumbOverlay}>
                                  <Play size={20} fill="#fff" />
                                </div>
                                {isDrillLandscape && thumbUrl && (
                                  <button
                                    className={styles.drillFullscreenBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFullscreen(null, thumbUrl);
                                    }}
                                  >
                                    <Maximize2 size={14} />
                                  </button>
                                )}
                              </div>

                              <div className={styles.drillInfo}>
                                <span className={styles.drillName}>{drill.name}</span>
                                <div className={styles.drillMetaRow}>
                                  {drill.rest_time != null && drill.rest_time > 0 && (
                                    <span className={styles.drillMetaItem}>
                                      <Clock size={12} /> {drill.rest_time} min rest
                                    </span>
                                  )}
                                  {drill.reps != null && drill.reps > 0 && (
                                    <span className={styles.drillMetaItem}>
                                      <Repeat size={12} /> {drill.reps} reps
                                    </span>
                                  )}
                                  {drill.sets != null && drill.sets > 1 && (
                                    <span className={styles.drillMetaItem}>
                                      <Layers size={12} /> {drill.sets} sets
                                    </span>
                                  )}
                                </div>
                              </div>

                              {drill.coaching_points && (
                                <button
                                  className={styles.coachingBtn}
                                  onClick={() => setCoachingModal(drill.coaching_points!)}
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Coaching points modal ── */}
      {coachingModal && (
        <div className={styles.modalOverlay} onClick={() => setCoachingModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Coaching Points</span>
              <button className={styles.modalClose} onClick={() => setCoachingModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>{coachingModal}</div>
          </div>
        </div>
      )}

      {/* ── Schedule modal ── */}
      {showScheduleModal && (
        <div className={styles.schedBackdrop} onClick={() => setShowScheduleModal(false)}>
          <div className={styles.schedSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.schedHandle}><div className={styles.schedHandleBar} /></div>
            <button className={styles.schedClose} onClick={() => setShowScheduleModal(false)}>
              <X size={18} />
            </button>

            {schedLoading ? (
              <div className={styles.schedContent}>
                <p className={styles.schedLoadingText}>Loading...</p>
              </div>
            ) : !booking ? (
              /* ── STATE A: New Booking ── */
              <div className={styles.schedContent}>
                <h3 className={styles.schedTitle}>
                  <Calendar size={20} /> Add to Schedule
                </h3>
                <label className={styles.schedLabel}>
                  Date
                  <input
                    type="date"
                    className={styles.schedInput}
                    value={selectedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </label>
                <label className={styles.schedLabel}>
                  Time
                  <input
                    type="time"
                    className={styles.schedInput}
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  />
                </label>
                <button
                  className={styles.schedSubmitBtn}
                  onClick={handleSchedule}
                  disabled={schedLoading}
                >
                  {schedLoading ? "Scheduling..." : "Schedule Session"}
                </button>
                <p className={styles.schedHint}>One session per skill per day</p>
              </div>
            ) : booking.status === "checked-in" ? (
              /* ── Checked In ── */
              <div className={styles.schedContent}>
                <div className={styles.schedStatusIcon} style={{ color: "#22c55e" }}>
                  <CheckCircle2 size={40} />
                </div>
                <h3 className={styles.schedTitle}>Session Complete!</h3>
                <span className={styles.schedStatusBadge} data-status="checked-in">Checked In</span>
                <p className={styles.schedPoints}>+8 points earned</p>
                {booking.checked_in_at && (
                  <p className={styles.schedMeta}>
                    Completed {new Date(booking.checked_in_at).toLocaleDateString()}
                  </p>
                )}
                {booking.completion_photo_url && (
                  <img
                    className={styles.schedPhotoPreview}
                    src={booking.completion_photo_url}
                    alt="Completion"
                  />
                )}
              </div>
            ) : booking.status === "pending_review" ? (
              /* ── Pending Review ── */
              <div className={styles.schedContent}>
                <h3 className={styles.schedTitle}>Waiting for Coach Review</h3>
                <span className={styles.schedStatusBadge} data-status="pending_review">Photo Uploaded</span>
                {booking.completion_photo_url && (
                  <img
                    className={styles.schedPhotoPreview}
                    src={booking.completion_photo_url}
                    alt="Completion"
                  />
                )}
                <p className={styles.schedMeta}>Waiting for coach to check in</p>
                <button
                  className={styles.schedSecondaryBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.schedFileInput}
                  onChange={handlePhotoSelect}
                />
                {photoPreview && (
                  <>
                    <img className={styles.schedPhotoPreview} src={photoPreview} alt="New" />
                    <button
                      className={styles.schedSubmitBtn}
                      onClick={handlePhotoUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? "Uploading..." : "Upload New Photo"}
                    </button>
                  </>
                )}
                <button className={styles.schedCancelLink} onClick={handleCancelBooking}>
                  Cancel Session
                </button>
              </div>
            ) : booking.status === "denied" ? (
              /* ── Denied ── */
              <div className={styles.schedContent}>
                <div className={styles.schedStatusIcon} style={{ color: "#ef4444" }}>
                  <AlertCircle size={40} />
                </div>
                <h3 className={styles.schedTitle}>Photo Denied</h3>
                <span className={styles.schedStatusBadge} data-status="denied">Needs New Photo</span>
                <p className={styles.schedMeta}>Coach requested a new photo</p>
                <div
                  className={styles.schedPhotoZone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={32} />
                  <span>Add Photo</span>
                  <span className={styles.schedPhotoHint}>
                    Take a picture of cones and ball on a field, in the backyard or at home to get your points
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.schedFileInput}
                  onChange={handlePhotoSelect}
                />
                {photoPreview && (
                  <>
                    <img className={styles.schedPhotoPreview} src={photoPreview} alt="New" />
                    <button
                      className={styles.schedSubmitBtn}
                      onClick={handlePhotoUpload}
                      disabled={isUploading}
                    >
                      <Upload size={16} /> {isUploading ? "Uploading..." : "Upload Photo"}
                    </button>
                  </>
                )}
                <button className={styles.schedCancelLink} onClick={handleCancelBooking}>
                  Cancel Session
                </button>
              </div>
            ) : (
              /* ── Scheduled (default State B) ── */
              <div className={styles.schedContent}>
                <h3 className={styles.schedTitle}>Session Scheduled</h3>
                <span className={styles.schedStatusBadge} data-status="scheduled">Scheduled</span>
                <p className={styles.schedMeta}>
                  {new Date(booking.scheduled_date + "T00:00").toLocaleDateString(undefined, {
                    weekday: "short", month: "short", day: "numeric",
                  })}
                  {booking.scheduled_time && ` at ${booking.scheduled_time}`}
                </p>
                <div
                  className={styles.schedPhotoZone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={32} />
                  <span>Add Photo</span>
                  <span className={styles.schedPhotoHint}>
                    Take a picture of cones and ball on a field, in the backyard or at home to get your points
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.schedFileInput}
                  onChange={handlePhotoSelect}
                />
                {photoPreview && (
                  <>
                    <img className={styles.schedPhotoPreview} src={photoPreview} alt="Preview" />
                    <button
                      className={styles.schedSubmitBtn}
                      onClick={handlePhotoUpload}
                      disabled={isUploading}
                    >
                      <Upload size={16} /> {isUploading ? "Uploading..." : "Upload Photo"}
                    </button>
                  </>
                )}
                <button className={styles.schedCancelLink} onClick={handleCancelBooking}>
                  Cancel Session
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Complete Session button — visible only at Level 0 ── */}
      {isOval && playerId && (
        <div className={styles.completeArea}>
          {completedToday ? (
            <div className={styles.completedBadge}>
              <CheckCircle2 size={20} />
              <span>Completed Today ✓</span>
              {completionCount > 1 && (
                <span className={styles.completedDate}>
                  Done {completionCount} times total
                </span>
              )}
            </div>
          ) : (
            <>
              {completionCount > 0 && (
                <span className={styles.completionHistory}>
                  Done {completionCount} time{completionCount !== 1 ? "s" : ""}
                </span>
              )}
              <button
                className={styles.completeBtn}
                onClick={handleComplete}
                disabled={isCompleting}
              >
                {isCompleting ? "Completing..." : "Complete Session \u2713"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Celebration overlay ── */}
      {showCelebration && (
        <div className={styles.celebrationOverlay}>
          <div className={styles.celebrationCard}>
            <div className={styles.celebrationIcon}>
              <CheckCircle2 size={56} />
            </div>
            <h2 className={styles.celebrationTitle}>Session Complete!</h2>
            {earnedPoints > 0 ? (
              <p className={styles.celebrationPoints}>+{earnedPoints} point{earnedPoints !== 1 ? "s" : ""}</p>
            ) : (
              <p className={styles.celebrationSubtext}>Session recorded!</p>
            )}
            <p className={styles.celebrationHint}>
              This will appear on your tracking dashboard
            </p>
            <button
              className={styles.celebrationDone}
              onClick={() => {
                setShowCelebration(false);
                onBack();
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop lightbox for landscape videos ── */}
      {lightboxUrl && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxUrl(null)}>
          <button
            className={styles.lightboxClose}
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <video
            ref={lightboxVideoRef}
            className={styles.lightboxVideo}
            src={lightboxUrl}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Toast ── */}
      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}
    </div>
  );
}
