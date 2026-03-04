"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronRight, Volume2, VolumeX, Maximize, X, Play, Pause, AlertTriangle, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentQuarter } from "@/lib/points";
import { getCurrentPeriod } from "@/lib/curriculum-period";
import styles from "./VideoReel.module.css";

export interface ReelVideo {
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
  duration?: number | null;
  orientation?: string | null;
  like_count?: number | null;
  view_count?: number | null;
  created_at: string;
}

export interface ReelSession {
  id: string;
  category: string;
  period: string;
  skill: string | null;
  main_exercises: Array<{ video_id: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface Props {
  videos: ReelVideo[];
  sessions: ReelSession[];
  mode: "start-here" | "tactical";
  period: string;
  playerId: string;
  likedVideoIds: string[];
  onGoToSession?: (sessionId: string) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoReel({ videos, sessions, mode, period, playerId, likedVideoIds, onGoToSession }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [currentTimes, setCurrentTimes] = useState<Map<number, number>>(new Map());
  const [durations, setDurations] = useState<Map<number, number>>(new Map());
  const [awardedSet, setAwardedSet] = useState<Set<string>>(new Set());
  const [progressMap, setProgressMap] = useState<Map<number, number>>(new Map());
  const [orientations, setOrientations] = useState<Map<number, "portrait" | "landscape">>(new Map());
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);
  const [pausedSet, setPausedSet] = useState<Set<number>>(() => new Set());
  const [tapIcon, setTapIcon] = useState<{ index: number; action: "play" | "pause" } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorSet, setErrorSet] = useState<Set<number>>(new Set());
  const [reelToast, setReelToast] = useState<string | null>(null);

  const viewedVideos = useRef(new Set<string>());
  const [likedSet, setLikedSet] = useState<Set<string>>(() => new Set(likedVideoIds || []));
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    videos.forEach((v) => m.set(v.id, v.like_count ?? 0));
    return m;
  });

  useEffect(() => {
    setLikedSet(new Set(likedVideoIds || []));
  }, [likedVideoIds]);

  useEffect(() => {
    const m = new Map<string, number>();
    videos.forEach((v) => m.set(v.id, v.like_count ?? 0));
    setLikeCounts(m);
  }, [videos]);

  const filteredVideos = (() => {
    if (mode === "start-here") {
      return [...videos]
        .filter((v) => v.category !== "tactical")
        .sort((a, b) => {
          const aLikes = likeCounts.get(a.id) ?? a.like_count ?? 0;
          const bLikes = likeCounts.get(b.id) ?? b.like_count ?? 0;
          if (bLikes !== aLikes) return bLikes - aLikes;
          const aViews = a.view_count ?? 0;
          const bViews = b.view_count ?? 0;
          if (bViews !== aViews) return bViews - aViews;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .slice(0, 15);
    }
    return videos.filter(
      (v) => v.category === "tactical" && (v.period === period || v.period === "all")
    );
  })();

  const findSessionForVideo = useCallback(
    (videoId: string): string | null => {
      for (const session of sessions) {
        if (session.main_exercises?.some((ex) => ex.video_id === videoId)) {
          return session.id;
        }
      }
      return null;
    },
    [sessions]
  );

  const trackView = useCallback(
    (videoId: string) => {
      if (viewedVideos.current.has(videoId)) return;
      viewedVideos.current.add(videoId);
      const supabase = createClient();
      supabase.rpc("increment_video_view", { p_video_id: videoId }).then(() => {});
    },
    []
  );

  const handleToggleLike = useCallback(
    async (videoId: string) => {
      if (!videoId || !playerId) return;

      let wasLiked = false;
      setLikedSet((prev) => {
        wasLiked = prev.has(videoId);
        const next = new Set(prev);
        if (wasLiked) next.delete(videoId);
        else next.add(videoId);
        return next;
      });
      setLikeCounts((prev) => {
        const next = new Map(prev);
        const current = next.get(videoId) ?? 0;
        next.set(videoId, wasLiked ? Math.max(current - 1, 0) : current + 1);
        return next;
      });

      try {
        const supabase = createClient();
        await supabase.rpc("toggle_video_like", {
          p_player_id: playerId,
          p_video_id: videoId,
        });
      } catch (e) {
        console.warn("Like toggle failed:", e);
        setLikedSet((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(videoId);
          else next.delete(videoId);
          return next;
        });
        setLikeCounts((prev) => {
          const next = new Map(prev);
          const current = next.get(videoId) ?? 0;
          next.set(videoId, wasLiked ? current + 1 : Math.max(current - 1, 0));
          return next;
        });
      }
    },
    [playerId]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute("data-reel-index"));
          const video = videoRefs.current.get(idx);

          if (entry.isIntersecting) {
            setActiveIndex(idx);
          } else if (video && !video.paused) {
            video.pause();
            setPausedSet((prev) => new Set(prev).add(idx));
          }
        }
      },
      { threshold: 0.7 }
    );

    const items = containerRef.current?.querySelectorAll("[data-reel-index]");
    items?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [filteredVideos.length]);

  useEffect(() => {
    const activeVideo = filteredVideos[activeIndex];
    if (activeVideo) trackView(activeVideo.id);
  }, [activeIndex, filteredVideos, trackView]);

  useEffect(() => {
    videoRefs.current.forEach((video) => {
      video.muted = muted;
    });
  }, [muted]);

  useEffect(() => {
    if (fullscreenIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenIdx(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fullscreenIdx]);

  const handleTimeUpdate = useCallback(
    (index: number, video: HTMLVideoElement, videoData: ReelVideo) => {
      const ct = video.currentTime;
      const dur = video.duration;

      setCurrentTimes((prev) => new Map(prev).set(index, ct));
      if (dur && isFinite(dur)) {
        setDurations((prev) => new Map(prev).set(index, dur));
        setProgressMap((prev) => new Map(prev).set(index, ct / dur));
      }

      if (
        mode === "tactical" &&
        dur &&
        isFinite(dur) &&
        ct / dur >= 0.95 &&
        !awardedSet.has(videoData.id)
      ) {
        setAwardedSet((prev) => new Set(prev).add(videoData.id));
        const supabase = createClient();
        const videoPeriod = videoData.period === "all" ? getCurrentPeriod() : (videoData.period || period);
        const now = new Date().toISOString();
        const { year, quarter } = getCurrentQuarter();

        (supabase as any)
          .from("player_curriculum_progress")
          .insert({
            player_id: playerId,
            period: videoPeriod,
            category: "tactical",
            session_type: "solo",
            video_id: videoData.id,
            points_earned: 0.3,
            completed_at: now,
          })
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.warn("[reel] progress insert failed:", error);
              return;
            }
            (supabase as any)
              .from("points_transactions")
              .insert({
                player_id: playerId,
                points: 0.3,
                session_type: "HG_TACTICAL_REEL",
                session_id: null,
                quarter_year: year,
                quarter_number: quarter,
                status: "active",
                checked_in_at: now,
              })
              .then(({ error: ptErr }: { error: unknown }) => {
                if (!ptErr) {
                  setReelToast("+0.3 points for watching!");
                  setTimeout(() => setReelToast(null), 2500);
                } else {
                  console.warn("[reel] points not awarded (non-blocking):", ptErr);
                  setReelToast("Video tracked!");
                  setTimeout(() => setReelToast(null), 2500);
                }
              });
          });
      }
    },
    [mode, awardedSet, playerId, period]
  );

  function detectOrientation(index: number, videoData: ReelVideo, el: HTMLVideoElement) {
    if (videoData.orientation === "portrait" || videoData.orientation === "landscape") {
      setOrientations((prev) => new Map(prev).set(index, videoData.orientation as "portrait" | "landscape"));
      return;
    }
    const w = el.videoWidth;
    const h = el.videoHeight;
    if (w && h) {
      setOrientations((prev) => new Map(prev).set(index, w > h ? "landscape" : "portrait"));
    }
  }

  function handleTapVideo(index: number) {
    const v = videoRefs.current.get(index);
    if (!v) return;

    if (v.paused) {
      v.play().catch(() => {});
      setPausedSet((prev) => { const n = new Set(prev); n.delete(index); return n; });
      showTapAnim(index, "play");
    } else {
      v.pause();
      setPausedSet((prev) => new Set(prev).add(index));
      showTapAnim(index, "pause");
    }
  }

  function showTapAnim(index: number, action: "play" | "pause") {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    setTapIcon({ index, action });
    tapTimerRef.current = setTimeout(() => setTapIcon(null), 600);
  }

  function handleFullscreen(index: number) {
    const video = videoRefs.current.get(index);
    if (!video) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile) {
      try {
        if (video.requestFullscreen) {
          video.requestFullscreen();
        } else if ((video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        }
        const so = (screen as any).orientation;
        if (so?.lock) so.lock("landscape").catch(() => {});
      } catch { /* */ }
    } else {
      setFullscreenIdx(index);
    }
  }

  function handleVideoError(index: number) {
    setErrorSet((prev) => new Set(prev).add(index));
  }

  function preloadFor(index: number): "none" | "metadata" {
    if (index === activeIndex || index === activeIndex - 1 || index === activeIndex + 1) {
      return "metadata";
    }
    return "none";
  }

  if (filteredVideos.length === 0) {
    return (
      <div className={styles.emptyReel}>
        <span className={styles.emptyReelText}>
          {mode === "tactical"
            ? "No tactical content yet. Check back soon!"
            : "No videos available yet. Check back soon!"}
        </span>
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <>
      <div className={styles.reelContainer} ref={containerRef}>
        {filteredVideos.map((video, index) => {
          const videoUrl = video.video_url?.startsWith("http")
            ? video.video_url
            : `${supabaseUrl}/storage/v1/object/public/solo-session-videos/${video.video_url}`;
          const ct = currentTimes.get(index) ?? 0;
          const dur = durations.get(index) ?? video.duration ?? 0;
          const progress = progressMap.get(index) ?? 0;
          const sessionId = findSessionForVideo(video.id);
          const isAwarded = awardedSet.has(video.id);
          const orientation = orientations.get(index) ?? "portrait";
          const isLandscape = orientation === "landscape";
          const isPaused = pausedSet.has(index);
          const hasError = errorSet.has(index);
          const showTap = tapIcon?.index === index;
          const isLiked = likedSet.has(video.id);
          const videoLikeCount = likeCounts.get(video.id) ?? video.like_count ?? 0;

          return (
            <div
              key={video.id}
              className={styles.reelItem}
              data-reel-index={index}
            >
              {hasError ? (
                <div className={styles.errorFallback}>
                  <AlertTriangle size={40} />
                  <span className={styles.errorTitle}>Video format not supported</span>
                  <span className={styles.errorSubtitle}>This video needs to be re-uploaded as MP4</span>
                </div>
              ) : (
                <>
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(index, el);
                      else videoRefs.current.delete(index);
                    }}
                    className={isLandscape ? styles.reelVideoLandscape : styles.reelVideoPortrait}
                    src={videoUrl}
                    loop={mode === "start-here"}
                    playsInline
                    muted={muted}
                    preload={preloadFor(index)}
                    onTimeUpdate={(e) => handleTimeUpdate(index, e.currentTarget, video)}
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      const d = el.duration;
                      if (d && isFinite(d)) {
                        setDurations((prev) => new Map(prev).set(index, d));
                      }
                      detectOrientation(index, video, el);
                    }}
                    onError={() => handleVideoError(index)}
                    onClick={() => handleTapVideo(index)}
                  />

                  {showTap && (
                    <div className={styles.tapIndicator}>
                      {tapIcon.action === "play" ? <Play size={40} /> : <Pause size={40} />}
                    </div>
                  )}

                  {isPaused && !showTap && (
                    <div className={styles.pausedIndicator} onClick={() => handleTapVideo(index)}>
                      <Play size={40} />
                    </div>
                  )}

                  {!isPaused && index === activeIndex && (() => {
                    const v = videoRefs.current.get(index);
                    if (!v || v.paused) {
                      return (
                        <div className={styles.pausedIndicator} onClick={() => handleTapVideo(index)}>
                          <Play size={40} />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Bottom info: drill name + coaching points + action buttons */}
                  <div className={styles.bottomOverlay}>
                    <div className={styles.bottomLeft}>
                      {video.title && (
                        <span className={styles.drillName}>{video.title}</span>
                      )}
                      {video.description && (
                        <span className={styles.coachingPoints}>{video.description}</span>
                      )}
                    </div>
                    <div className={styles.bottomRight}>
                      <button
                        className={styles.likeButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(video.id);
                        }}
                      >
                        <Heart
                          size={24}
                          fill={isLiked ? "#ff3040" : "none"}
                          color={isLiked ? "#ff3040" : "white"}
                        />
                        <span className={styles.likeCount}>
                          {videoLikeCount}
                        </span>
                      </button>
                      {isLandscape && (
                        <button
                          className={styles.fullscreenBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFullscreen(index);
                          }}
                        >
                          <Maximize size={18} />
                        </button>
                      )}
                      {sessionId && onGoToSession && (
                        <button
                          className={styles.goToSessionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onGoToSession(sessionId);
                          }}
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom controls: time counter (centered) + mute (right) */}
                  <div className={styles.bottomControls}>
                    <div className={styles.durationPill}>
                      {formatTime(ct)} / {formatTime(dur)}
                    </div>
                    <button
                      className={styles.muteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMuted((m) => !m);
                      }}
                    >
                      {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                  </div>

                  {mode === "tactical" && (
                    <>
                      <div className={styles.progressBarTrack}>
                        <div
                          className={styles.progressBarFill}
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      {isAwarded && (
                        <div className={styles.awardedBadge}>+0.3 pts</div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {fullscreenIdx !== null && (() => {
        const v = filteredVideos[fullscreenIdx];
        if (!v) return null;
        const url = v.video_url?.startsWith("http")
          ? v.video_url
          : `${supabaseUrl}/storage/v1/object/public/solo-session-videos/${v.video_url}`;
        return (
          <div
            className={styles.fullscreenOverlay}
            onClick={() => setFullscreenIdx(null)}
          >
            <button
              className={styles.fullscreenClose}
              onClick={() => setFullscreenIdx(null)}
            >
              <X size={20} />
            </button>
            <video
              className={styles.fullscreenVideo}
              src={url}
              controls
              autoPlay
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      })()}

      {reelToast && (
        <div className={styles.reelToast}>{reelToast}</div>
      )}
    </>
  );
}
