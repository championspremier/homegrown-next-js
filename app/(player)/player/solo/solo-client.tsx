"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Crosshair,
  Dumbbell,
  Brain,
  Swords,
  ChevronRight,
  ArrowLeft,
  Clock,
  FileVideo,
  Lock,
} from "lucide-react";
import { PlanGate } from "@/components/plan-gate/PlanGate";
import { usePlanAccess } from "@/components/plan-gate/PlanAccessContext";
import {
  TECHNICAL_SUB_SKILLS,
  PHYSICAL_SKILLS,
  PHYSICAL_SUB_SKILLS,
  MENTAL_SKILLS,
  formatLabel,
  getPrimaryTechnicalSkills,
  getDefaultPhysicalSeason,
} from "@/lib/curriculum";
import { getPeriodLabel } from "@/lib/curriculum-period";
import VideoReel, { type ReelVideo, type ReelSession } from "./components/VideoReel";
import SessionDetail from "./components/SessionDetail";
import TrainingTab, { type ExerciseLibraryItem, type TrainingLog } from "./components/TrainingTab";
import styles from "./solo.module.css";

/* ── Interfaces ── */
interface SoloVideo {
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
  created_at: string;
}

interface SoloSession {
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
  is_active: boolean;
  title: string | null;
  description?: string | null;
  created_at: string;
}

interface SkillThumbnail {
  id: string;
  category: string;
  skill: string | null;
  sub_skill: string | null;
  period: string;
  thumbnail_url: string;
}

interface Props {
  playerId: string;
  sessions: SoloSession[];
  videos: SoloVideo[];
  thumbnails: SkillThumbnail[];
  currentPeriod: string;
  likedVideoIds: string[];
  exerciseLibrary: ExerciseLibraryItem[];
  recentTrainingLogs: TrainingLog[];
  weeklyHgMinutes: number;
  eliteTargetHours: number;
}

type Tab = "start-here" | "technical" | "physical" | "mental" | "tactical" | "training";

interface NavState {
  tab: Tab;
  skill: string | null;
  subSkill: string | null;
  sessionId: string | null;
  physicalSeason: string;
}

const TAB_ORDER: Tab[] = ["start-here", "technical", "physical", "mental", "tactical", "training"];
const SOLO_TAB_KEYS = ["technical", "tactical", "physical", "mental"] as const;

const TAB_LABELS: Record<Tab, string> = {
  "start-here": "Start Here",
  technical: "Technical",
  physical: "Physical",
  mental: "Mental",
  tactical: "Tactical",
  training: "Log",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  technical: "linear-gradient(135deg, #1e3a5f, #2d5a87)",
  physical: "linear-gradient(135deg, #1e5f3a, #2d8757)",
  mental: "linear-gradient(135deg, #5f1e5f, #872d87)",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#22c55e",
  intermediate: "#eab308",
  advanced: "#ef4444",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  technical: Crosshair,
  physical: Dumbbell,
  mental: Brain,
  tactical: Swords,
};

function calculateDuration(session: SoloSession): number {
  const exercises = session.main_exercises || [];
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

export default function SoloClient({ playerId, sessions, videos, thumbnails, currentPeriod, likedVideoIds, exerciseLibrary, recentTrainingLogs, weeklyHgMinutes, eliteTargetHours }: Props) {
  const planAccess = usePlanAccess();
  const soloLocked = !planAccess.soloAccess;
  const soloReason = planAccess.hasPlan;

  function isTabLocked(tabKey: string): boolean {
    if (!SOLO_TAB_KEYS.includes(tabKey as (typeof SOLO_TAB_KEYS)[number])) return false;
    const allowance = planAccess.sessionAllowances?.solo?.[tabKey] ?? 0;
    const used = planAccess.sessionUsage?.solo?.[tabKey] ?? 0;
    return allowance === 0 || (allowance !== -1 && used >= allowance);
  }

  function getTabLockReason(tabKey: string): string {
    const allowance = planAccess.sessionAllowances?.solo?.[tabKey] ?? 0;
    const used = planAccess.sessionUsage?.solo?.[tabKey] ?? 0;
    const tabName = TAB_LABELS[tabKey as Tab] || tabKey;
    if (allowance === 0) return `Your plan doesn't include ${tabName} sessions. Contact your coach to upgrade.`;
    return `You've used all ${allowance} ${tabName} sessions this billing period.`;
  }

  const [nav, setNav] = useState<NavState>({
    tab: "start-here",
    skill: null,
    subSkill: null,
    sessionId: null,
    physicalSeason: getDefaultPhysicalSeason(),
  });

  const [loading, setLoading] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  const currentTabLocked = SOLO_TAB_KEYS.includes(nav.tab as (typeof SOLO_TAB_KEYS)[number]) && isTabLocked(nav.tab);

  const navigateTo = useCallback((patch: Partial<NavState>) => {
    setLoading(true);
    setNav((prev) => ({ ...prev, ...patch }));
    setTimeout(() => setLoading(false), 50);
  }, []);

  useEffect(() => {
    viewRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, [nav.tab, nav.skill, nav.subSkill, nav.sessionId]);

  const activeCategory = nav.tab === "start-here" ? null : nav.tab;
  const isReelTab = nav.tab === "start-here" || nav.tab === "tactical";

  const sessionsForTab = useMemo(() => {
    if (!activeCategory) return [];
    if (activeCategory === "physical") {
      return sessions.filter(
        (s) =>
          s.category === "physical" &&
          (s.period === nav.physicalSeason || s.period === "all")
      );
    }
    if (activeCategory === "mental") {
      return sessions.filter((s) => s.category === "mental");
    }
    return sessions.filter(
      (s) => s.category === activeCategory && s.period === currentPeriod
    );
  }, [sessions, activeCategory, currentPeriod, nav.physicalSeason]);

  const technicalSkills = useMemo(
    () => getPrimaryTechnicalSkills(currentPeriod),
    [currentPeriod]
  );

  const findThumbnail = useCallback(
    (category: string, skill: string | null, period: string) =>
      thumbnails.find(
        (t) =>
          t.category === category &&
          t.period === period &&
          (t.skill || null) === (skill || null)
      ),
    [thumbnails]
  );

  const sessionCountForSkill = useCallback(
    (skill: string) => sessionsForTab.filter((s) => s.skill === skill).length,
    [sessionsForTab]
  );

  const selectedSession = useMemo(
    () => (nav.sessionId ? sessions.find((s) => s.id === nav.sessionId) : null),
    [sessions, nav.sessionId]
  );

  const sessionsWithSubSkillForCurrentSkill = useMemo(() => {
    if (!nav.skill) return false;
    return sessionsForTab.some(
      (s) => s.skill === nav.skill && s.sub_skill && s.sub_skill.length > 0
    );
  }, [sessionsForTab, nav.skill]);

  const viewLevel = nav.sessionId
    ? "session"
    : nav.subSkill
      ? "sessions"
      : nav.skill
        ? "subskills"
        : "skills";

  const showBack = !isReelTab && viewLevel !== "skills";

  /* ── Breadcrumb ── */
  function renderBreadcrumb() {
    if (!activeCategory) return null;
    const crumbs: { label: string; action: (() => void) | null }[] = [];
    crumbs.push({
      label: TAB_LABELS[nav.tab],
      action:
        viewLevel !== "skills"
          ? () => navigateTo({ skill: null, subSkill: null, sessionId: null })
          : null,
    });
    if (nav.skill) {
      crumbs.push({
        label: formatLabel(nav.skill),
        action:
          viewLevel !== "subskills"
            ? () => navigateTo({ subSkill: null, sessionId: null })
            : null,
      });
    }
    if (nav.subSkill) {
      crumbs.push({
        label: formatLabel(nav.subSkill),
        action: viewLevel !== "sessions" ? () => navigateTo({ sessionId: null }) : null,
      });
    }

    return (
      <div className={styles.breadcrumb}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <ChevronRight size={12} className={styles.breadcrumbSep} />}
            {c.action ? (
              <button className={styles.breadcrumbBtn} onClick={c.action}>
                {c.label}
              </button>
            ) : (
              <span className={styles.breadcrumbCurrent}>{c.label}</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  function handleBack() {
    if (nav.sessionId) navigateTo({ sessionId: null });
    else if (nav.subSkill) navigateTo({ subSkill: null });
    else if (nav.skill) navigateTo({ skill: null });
  }

  function renderEmpty(msg: string) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <FileVideo size={22} />
        </div>
        <span className={styles.emptyTitle}>Nothing here yet</span>
        <span className={styles.emptyText}>{msg}</span>
      </div>
    );
  }

  /* ── Skill row card ── */
  function renderSkillRow(skill: string, category: string, icon: React.ElementType) {
    const count = sessionCountForSkill(skill);
    const thumb = findThumbnail(category, skill, currentPeriod);
    const Icon = icon;
    const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.technical;

    return (
      <div
        key={skill}
        className={styles.skillRow}
        onClick={() => navigateTo({ skill })}
      >
        {thumb ? (
          <img
            src={thumb.thumbnail_url}
            alt={formatLabel(skill)}
            className={styles.skillRowThumb}
            loading="lazy"
          />
        ) : (
          <div className={styles.skillRowIconBox} style={{ background: gradient }}>
            <Icon size={28} />
          </div>
        )}
        <div className={styles.skillRowInfo}>
          <span className={styles.skillRowName}>{formatLabel(skill)}</span>
          <span className={styles.skillRowCount}>
            {count} session{count !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronRight size={18} className={styles.skillRowChevron} />
      </div>
    );
  }

  /* ── Technical skill list ── */
  function renderTechnicalSkillList() {
    return (
      <>
        <div className={styles.periodBadge}>
          <span className={styles.periodDot} />
          {getPeriodLabel(currentPeriod)}
        </div>
        <div className={styles.skillList}>
          {technicalSkills.map((skill) => renderSkillRow(skill, "technical", Crosshair))}
        </div>
      </>
    );
  }

  /* ── Sub-skills (smart skip if none have sub_skill) ── */
  function renderSubSkills(subSkillMap: Record<string, string[]>, category: string) {
    if (!sessionsWithSubSkillForCurrentSkill) {
      return renderSessionList(sessionsForTab.filter((s) => s.skill === nav.skill));
    }

    const subSkills = subSkillMap[nav.skill!] || [];
    if (subSkills.length === 0) {
      return renderSessionList(sessionsForTab.filter((s) => s.skill === nav.skill));
    }

    const sessionsWithoutSub = sessionsForTab.filter(
      (s) => s.skill === nav.skill && (!s.sub_skill || s.sub_skill.length === 0)
    );
    const Icon = CATEGORY_ICON[category] || Crosshair;
    const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.technical;

    return (
      <div className={styles.skillList}>
        {sessionsWithoutSub.length > 0 && (
          <div
            className={styles.skillRow}
            onClick={() => navigateTo({ subSkill: "__general__" })}
          >
            <div className={styles.skillRowIconBox} style={{ background: gradient }}>
              <Icon size={28} />
            </div>
            <div className={styles.skillRowInfo}>
              <span className={styles.skillRowName}>General</span>
              <span className={styles.skillRowCount}>
                {sessionsWithoutSub.length} session{sessionsWithoutSub.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ChevronRight size={18} className={styles.skillRowChevron} />
          </div>
        )}
        {subSkills.map((sub) => {
          const count = sessionsForTab.filter(
            (s) => s.skill === nav.skill && s.sub_skill === sub
          ).length;
          const thumb = findThumbnail(category, sub, currentPeriod);
          return (
            <div
              key={sub}
              className={styles.skillRow}
              onClick={() => navigateTo({ subSkill: sub })}
            >
              {thumb ? (
                <img
                  src={thumb.thumbnail_url}
                  alt={formatLabel(sub)}
                  className={styles.skillRowThumb}
                  loading="lazy"
                />
              ) : (
                <div className={styles.skillRowIconBox} style={{ background: gradient }}>
                  <Icon size={28} />
                </div>
              )}
              <div className={styles.skillRowInfo}>
                <span className={styles.skillRowName}>{formatLabel(sub)}</span>
                <span className={styles.skillRowCount}>
                  {count} session{count !== 1 ? "s" : ""}
                </span>
              </div>
              <ChevronRight size={18} className={styles.skillRowChevron} />
            </div>
          );
        })}
      </div>
    );
  }

  /* ── Physical / Mental skill lists ── */
  function renderPhysicalSkillList() {
    return (
      <>
        <div className={styles.seasonToggle}>
          {["in-season", "off-season"].map((s) => (
            <button
              key={s}
              className={`${styles.seasonCard} ${nav.physicalSeason === s ? styles.seasonCardActive : styles.seasonCardInactive}`}
              onClick={() => navigateTo({ physicalSeason: s, skill: null, subSkill: null, sessionId: null })}
            >
              {s === "in-season" ? "In-Season" : "Off-Season"}
            </button>
          ))}
        </div>
        <div className={styles.skillList}>
          {PHYSICAL_SKILLS.map((skill) => renderSkillRow(skill, "physical", Dumbbell))}
        </div>
      </>
    );
  }

  function renderMentalSkillList() {
    return (
      <div className={styles.skillList}>
        {MENTAL_SKILLS.map((skill) => renderSkillRow(skill, "mental", Brain))}
      </div>
    );
  }

  /* ── Session hero cards ── */
  function renderSessionList(list: SoloSession[]) {
    if (list.length === 0) {
      const skillLabel = nav.subSkill && nav.subSkill !== "__general__"
        ? formatLabel(nav.subSkill)
        : nav.skill
          ? formatLabel(nav.skill)
          : nav.tab;
      return renderEmpty(`Sessions coming soon for ${skillLabel}. Check back later!`);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const category = activeCategory || "technical";
    const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.technical;
    const Icon = CATEGORY_ICON[category] || Crosshair;

    return (
      <div className={styles.sessionList}>
        {list.map((session) => {
          const firstDrill = session.main_exercises?.[0];
          const thumbUrl = firstDrill?.path
            ? `${supabaseUrl}/storage/v1/object/public/solo-session-videos/${firstDrill.path}`
            : null;
          const diffColor = DIFFICULTY_COLORS[session.difficulty_level] || "#6b7280";
          const estMin = calculateDuration(session);

          return (
            <div
              key={session.id}
              className={styles.sessionHero}
              style={!thumbUrl ? { background: gradient } : undefined}
              onClick={() => navigateTo({ sessionId: session.id })}
            >
              {thumbUrl && (
                <video
                  className={styles.sessionHeroBg}
                  src={thumbUrl}
                  muted
                  playsInline
                  preload="metadata"
                />
              )}
              <div className={styles.sessionHeroOverlay}>
                <div className={styles.sessionHeroTop}>
                  <span className={styles.sessionHeroBadge}>Get Started</span>
                  {session.sub_skill && (
                    <span className={styles.sessionHeroSubSkill}>
                      {formatLabel(session.sub_skill)}
                    </span>
                  )}
                </div>
                <div className={styles.sessionHeroBottom}>
                  <span className={styles.sessionHeroLevel} style={{ color: diffColor }}>
                    {formatLabel(session.difficulty_level)}
                  </span>
                  <span className={styles.sessionHeroDuration}>
                    <Clock size={13} /> {estMin} min
                  </span>
                </div>
              </div>
              {!thumbUrl && (
                <div className={styles.sessionHeroIconFallback}>
                  <Icon size={44} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function getSessionsForCurrentView(): SoloSession[] {
    if (nav.subSkill === "__general__") {
      return sessionsForTab.filter(
        (s) => s.skill === nav.skill && (!s.sub_skill || s.sub_skill.length === 0)
      );
    }
    if (nav.subSkill) {
      return sessionsForTab.filter(
        (s) => s.skill === nav.skill && s.sub_skill === nav.subSkill
      );
    }
    if (nav.skill) {
      return sessionsForTab.filter((s) => s.skill === nav.skill);
    }
    return sessionsForTab;
  }

  /* ── View router ── */
  function renderView() {
    if (loading && !isReelTab) {
      return (
        <div className={styles.skeletonList}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      );
    }

    if (nav.tab === "start-here") {
      return (
        <VideoReel
          videos={videos as ReelVideo[]}
          sessions={sessions as unknown as ReelSession[]}
          mode="start-here"
          period={currentPeriod}
          playerId={playerId}
          likedVideoIds={likedVideoIds}
          onGoToSession={(id) => {
            const s = sessions.find((x) => x.id === id);
            if (s) {
              const tab = s.category as Tab;
              navigateTo({ tab, skill: s.skill, subSkill: null, sessionId: id });
            }
          }}
        />
      );
    }

    if (nav.tab === "tactical") {
      return (
        <VideoReel
          videos={videos as ReelVideo[]}
          sessions={sessions as unknown as ReelSession[]}
          mode="tactical"
          period={currentPeriod}
          playerId={playerId}
          likedVideoIds={likedVideoIds}
          onGoToSession={(id) => navigateTo({ sessionId: id })}
        />
      );
    }

    if (nav.tab === "training") {
      return (
        <TrainingTab
          exerciseLibrary={exerciseLibrary}
          recentTrainingLogs={recentTrainingLogs as TrainingLog[]}
          playerId={playerId}
          weeklyHgMinutes={weeklyHgMinutes}
          eliteTargetHours={eliteTargetHours}
        />
      );
    }

    switch (nav.tab) {
      case "technical":
        if (nav.subSkill) return renderSessionList(getSessionsForCurrentView());
        if (nav.skill) return renderSubSkills(TECHNICAL_SUB_SKILLS, "technical");
        return renderTechnicalSkillList();

      case "physical":
        if (nav.subSkill) return renderSessionList(getSessionsForCurrentView());
        if (nav.skill) return renderSubSkills(PHYSICAL_SUB_SKILLS, "physical");
        return renderPhysicalSkillList();

      case "mental":
        if (nav.skill) return renderSessionList(getSessionsForCurrentView());
        return renderMentalSkillList();

      default:
        return null;
    }
  }

  return (
    <PlanGate locked={soloLocked} reason={soloReason} planName={planAccess.planName} hasPlan={planAccess.hasPlan}>
      <div
        className={`${styles.container} ${isReelTab ? styles.containerReel : styles.containerCard}`}
        ref={viewRef}
      >
        <div className={`${styles.tabBar} ${isReelTab ? styles.tabBarReel : ""}`}>
          {TAB_ORDER.map((key) => {
            const locked = isTabLocked(key);
            return (
              <button
                key={key}
                className={`${styles.tab} ${nav.tab === key ? styles.tabActive : ""}`}
                onClick={() =>
                  navigateTo({ tab: key, skill: null, subSkill: null, sessionId: null })
                }
              >
                {locked && <Lock size={12} className={styles.tabLockIcon} />}
                {TAB_LABELS[key]}
              </button>
            );
          })}
        </div>

        {currentTabLocked && (
          <div className={styles.tabLockBanner}>
            {getTabLockReason(nav.tab)}
          </div>
        )}

        {showBack && !nav.sessionId && !currentTabLocked && renderBreadcrumb()}
        {showBack && !nav.sessionId && !currentTabLocked && (
          <button className={styles.backBtn} onClick={handleBack}>
            <ArrowLeft size={18} />
            Back
          </button>
        )}

        <div
          className={isReelTab ? undefined : styles.viewWrapper}
          key={`${nav.tab}-${nav.skill}-${nav.subSkill}`}
        >
          {currentTabLocked ? null : renderView()}
        </div>
      </div>

      {/* Full-screen session detail overlay — rendered outside the container */}
      {nav.sessionId && selectedSession && (
        <SessionDetail
          session={selectedSession}
          onBack={() => navigateTo({ sessionId: null })}
          playerId={playerId}
          likedVideoIds={likedVideoIds}
        />
      )}
    </PlanGate>
  );
}
