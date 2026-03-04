"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Trophy, CheckCircle, XCircle, ChevronDown, ChevronUp, Info } from "lucide-react";
import SpiderChart from "./SpiderChart";
import styles from "./PillarTabs.module.css";

interface Axis {
  key: string;
  label: string;
  coachOnly: boolean;
}

interface PillarData {
  axes: Axis[];
  scores: Record<string, number | null>;
}

interface PointsHistoryItem {
  checked_in_at: string;
  session_type: string;
  points: number;
}

interface PointsData {
  total: number;
  position: number | null;
  quarterLabel: string;
  history: PointsHistoryItem[];
}

interface QuizHistoryItem {
  id: string;
  selected_answer: number;
  is_correct: boolean;
  answered_at: string;
  points_awarded: number | null;
  status: string;
  quiz_question: {
    question: string;
    options: string[];
    correct_answer: number;
    explanation: string | null;
    period: string | null;
    category: string | null;
  } | null;
}

interface ObjectiveItem {
  id: string;
  in_possession_objective: string | null;
  out_of_possession_objective: string | null;
  is_active?: boolean;
  created_at: string;
  completed_at?: string;
}

interface Props {
  spiderData: Record<string, PillarData>;
  pointsData: PointsData;
  quizHistory?: unknown[];
  activeObjectives?: unknown;
  pastObjectives?: unknown[];
}

const PILLARS = [
  { key: "tactical", label: "Tactical" },
  { key: "technical", label: "Technical" },
  { key: "physical", label: "Physical" },
  { key: "mental", label: "Mental" },
];

function formatDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dNorm = new Date(d);
  dNorm.setHours(0, 0, 0, 0);

  if (dNorm.getTime() === today.getTime()) return "Today";
  if (dNorm.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PillarTabs({
  spiderData,
  pointsData,
  quizHistory: rawQuizHistory,
  activeObjectives: rawActiveObj,
  pastObjectives: rawPastObj,
}: Props) {
  const [activePillar, setActivePillar] = useState(0);
  const [subTab, setSubTab] = useState<"points" | "quiz" | "objectives">("points");
  const [visiblePointsCount, setVisiblePointsCount] = useState(3);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [infoTip, setInfoTip] = useState<string | null>(null);
  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleInfo = useCallback((key: string) => {
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    setInfoTip((prev) => (prev === key ? null : key));
    infoTimerRef.current = setTimeout(() => setInfoTip(null), 5000);
  }, []);

  const pillarKey = PILLARS[activePillar].key;
  const currentPillar = spiderData[pillarKey];

  const quizHistory = (rawQuizHistory || []) as QuizHistoryItem[];
  const activeObjective = (rawActiveObj || null) as ObjectiveItem | null;
  const pastObjectives = (rawPastObj || []) as ObjectiveItem[];

  const groupedHistory = useMemo(() => {
    const groups: { date: string; label: string; items: PointsHistoryItem[] }[] = [];
    const map = new Map<string, PointsHistoryItem[]>();
    for (const h of pointsData.history) {
      const d = h.checked_in_at?.split("T")[0] || "unknown";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(h);
    }
    for (const [date, items] of map) {
      groups.push({ date, label: formatDateGroupLabel(date), items });
    }
    return groups;
  }, [pointsData.history]);

  return (
    <div className={styles.container}>
      {/* Pillar cards */}
      <div className={styles.pillarStack}>
        {PILLARS.map((p, i) => {
          const offset = i - activePillar;
          const absOff = Math.abs(offset);
          const isActive = i === activePillar;
          const scale = isActive ? 1.08 : Math.max(0.82, 1 - absOff * 0.08);
          const translateX = isActive ? 0 : offset * 58;
          const zIndex = isActive ? 10 : 6 - absOff;
          const opacity = isActive ? 1 : Math.max(0.35, 0.7 - absOff * 0.2);
          return (
            <button
              key={p.key}
              type="button"
              className={`${styles.pillarCard} ${isActive ? styles.pillarCardActive : ""}`}
              style={{
                transform: `translateX(${translateX}px) scale(${scale})`,
                opacity,
                zIndex,
              }}
              onClick={() => setActivePillar(i)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Spider chart card */}
      {currentPillar && (
        <div className={styles.spiderCard}>
          <div className={styles.tabContentHeader}>
            <span />
            <div className={styles.infoWrap}>
              <button type="button" className={styles.infoBtn} onClick={() => toggleInfo("spider")}>
                <Info size={14} />
              </button>
              {infoTip === "spider" && (
                <div className={styles.infoTooltip}>
                  The spider chart tracks your development across 4 pillars: Technical, Physical, Mental, and Tactical. It{"\u2019"}s based on your curriculum period activities and solo session completions.
                </div>
              )}
            </div>
          </div>
          <SpiderChart axes={currentPillar.axes} scores={currentPillar.scores} />

          {/* Legend */}
          <div className={styles.legend}>
            {currentPillar.axes.map((axis) => {
              const score = currentPillar.scores[axis.key];
              const isCoach = axis.coachOnly;
              const pct = score != null ? (score / 10) * 100 : 0;
              return (
                <div key={axis.key} className={`${styles.legendRow} ${isCoach ? styles.legendRowCoach : ""}`}>
                  <span className={styles.legendDot} />
                  <span className={styles.legendLabel}>{axis.label}</span>
                  <span className={styles.legendValue}>
                    {isCoach ? "—" : `${(score ?? 0).toFixed(1)} Sessions`}
                  </span>
                  <div className={styles.legendBar}>
                    <div
                      className={styles.legendBarFill}
                      style={{ width: `${isCoach ? 0 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className={styles.subTabs}>
        {(["points", "quiz", "objectives"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.subTab} ${subTab === tab ? styles.subTabActive : ""}`}
            onClick={() => { setSubTab(tab); setVisiblePointsCount(3); }}
          >
            {tab === "points" ? "Points" : tab === "quiz" ? "Quiz" : "Objectives"}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "points" && (
        <div className={styles.pointsSection}>
          <div className={styles.tabContentHeader}>
            <h3 className={styles.tabContentTitle}>Points</h3>
            <div className={styles.infoWrap}>
              <button type="button" className={styles.infoBtn} onClick={() => toggleInfo("points")}>
                <Info size={14} />
              </button>
              {infoTip === "points" && (
                <div className={styles.infoTooltip}>
                  Points are earned from sessions, quizzes, and solo work. They reset each quarter and contribute to your leaderboard ranking.
                </div>
              )}
            </div>
          </div>
          <div className={styles.quarterCard}>
            <span className={styles.quarterHeading}>Current Quarter</span>
            <span className={styles.quarterLabel}>{pointsData.quarterLabel}</span>
            <span className={styles.quarterPoints}>
              {pointsData.total.toFixed(1)}
            </span>
            <span className={styles.quarterPtsLabel}>Total Points</span>
            {pointsData.position != null && (
              <span className={styles.quarterPosition}>
                <Trophy size={14} /> Position: #{pointsData.position}
              </span>
            )}
          </div>

          <div className={styles.historySection}>
            <span className={styles.historyTitle}>Points History</span>

            {groupedHistory.length === 0 ? (
              <p className={styles.emptyState}>No points earned this quarter yet.</p>
            ) : (
              (() => {
                let shown = 0;
                const totalItems = pointsData.history.length;
                return (
                  <>
                    {groupedHistory.map((group) => {
                      if (shown >= visiblePointsCount) return null;
                      const remaining = visiblePointsCount - shown;
                      const visibleItems = group.items.slice(0, remaining);
                      shown += visibleItems.length;
                      return (
                        <div key={group.date} className={styles.historyGroup}>
                          <span className={styles.historyDateLabel}>{group.label}</span>
                          {visibleItems.map((item, idx) => (
                            <div key={idx} className={styles.historyRow}>
                              <div className={styles.historyRowLeft}>
                                <span className={styles.historyType}>{item.session_type}</span>
                              </div>
                              <span className={styles.historyPts}>+{item.points.toFixed(1)} pts</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {visiblePointsCount < totalItems && (
                      <button
                        type="button"
                        className={styles.loadMoreBtn}
                        onClick={() => setVisiblePointsCount((p) => p + 3)}
                      >
                        Load More ({totalItems - visiblePointsCount} remaining)
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ═══ Quiz tab ═══ */}
      {subTab === "quiz" && (
        <div className={styles.quizSection}>
          <div className={styles.tabContentHeader}>
            <h3 className={styles.tabContentTitle}>Quiz History</h3>
            <div className={styles.infoWrap}>
              <button type="button" className={styles.infoBtn} onClick={() => toggleInfo("quiz")}>
                <Info size={14} />
              </button>
              {infoTip === "quiz" && (
                <div className={styles.infoTooltip}>
                  Quiz history shows all quizzes you{"\u2019"}ve answered from your coach. Correct answers earn 1 point. You can answer up to 15 quizzes per day.
                </div>
              )}
            </div>
          </div>
          {quizHistory.length === 0 ? (
            <div className={styles.emptyTab}>
              No quiz answers yet. Complete quizzes on the Home page to see your history here.
            </div>
          ) : (
            quizHistory.map((q) => {
              const qq = q.quiz_question;
              if (!qq) return null;
              const isExpanded = expandedQuiz === q.id;
              return (
                <div
                  key={q.id}
                  className={`${styles.quizCard} ${q.is_correct ? styles.quizCorrect : styles.quizIncorrect}`}
                >
                  <div className={styles.quizCardTop}>
                    <div className={styles.quizResultIcon}>
                      {q.is_correct
                        ? <CheckCircle size={18} className={styles.quizIconCorrect} />
                        : <XCircle size={18} className={styles.quizIconIncorrect} />
                      }
                      {q.points_awarded != null && q.points_awarded > 0 && (
                        <span className={styles.quizPts}>+{q.points_awarded} pts</span>
                      )}
                    </div>
                    <span className={styles.quizDate}>{formatShortDate(q.answered_at)}</span>
                  </div>
                  <p className={styles.quizQuestion}>{qq.question}</p>
                  <div className={styles.quizBadges}>
                    {qq.category && <span className={styles.quizBadge}>{qq.category}</span>}
                    {qq.period && <span className={styles.quizBadge}>{qq.period}</span>}
                  </div>
                  {qq.explanation && (
                    <button
                      type="button"
                      className={styles.quizExpandBtn}
                      onClick={() => setExpandedQuiz(isExpanded ? null : q.id)}
                    >
                      {isExpanded ? "Hide explanation" : "Show explanation"}
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  {isExpanded && qq.explanation && (
                    <p className={styles.quizExplanation}>{qq.explanation}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ Objectives tab ═══ */}
      {subTab === "objectives" && (
        <div className={styles.objectivesSection}>
          <div className={styles.tabContentHeader}>
            <h3 className={styles.tabContentTitle}>Objectives</h3>
            <div className={styles.infoWrap}>
              <button type="button" className={styles.infoBtn} onClick={() => toggleInfo("objectives")}>
                <Info size={14} />
              </button>
              {infoTip === "objectives" && (
                <div className={styles.infoTooltip}>
                  Objectives are set by your coach once per week, typically after a CPP 2+ session. They guide your in-possession and out-of-possession focus areas.
                </div>
              )}
            </div>
          </div>
          {!activeObjective && pastObjectives.length === 0 ? (
            <div className={styles.emptyTab}>
              No active objectives. Your coach will assign objectives for you.
            </div>
          ) : (
            <>
              {activeObjective && (
                <div className={styles.objectiveCard}>
                  <span className={styles.objectiveBadgeCurrent}>Current</span>
                  {activeObjective.in_possession_objective && (
                    <div className={styles.objectiveBlock}>
                      <span className={styles.objectiveType}>In Possession</span>
                      <p className={styles.objectiveText}>{activeObjective.in_possession_objective}</p>
                    </div>
                  )}
                  {activeObjective.out_of_possession_objective && (
                    <div className={styles.objectiveBlock}>
                      <span className={styles.objectiveType}>Out of Possession</span>
                      <p className={styles.objectiveText}>{activeObjective.out_of_possession_objective}</p>
                    </div>
                  )}
                  <span className={styles.objectiveMeta}>
                    Set {formatShortDate(activeObjective.created_at)}
                  </span>
                </div>
              )}

              {pastObjectives.length > 0 && (
                <div className={styles.pastObjectivesWrap}>
                  <span className={styles.pastObjectivesTitle}>Past Objectives</span>
                  {pastObjectives.map((obj) => (
                    <div key={obj.id} className={styles.objectiveCardPast}>
                      {obj.in_possession_objective && (
                        <div className={styles.objectiveBlock}>
                          <span className={styles.objectiveType}>In Possession</span>
                          <p className={styles.objectiveText}>{obj.in_possession_objective}</p>
                        </div>
                      )}
                      {obj.out_of_possession_objective && (
                        <div className={styles.objectiveBlock}>
                          <span className={styles.objectiveType}>Out of Possession</span>
                          <p className={styles.objectiveText}>{obj.out_of_possession_objective}</p>
                        </div>
                      )}
                      <span className={styles.objectiveMeta}>
                        {obj.completed_at ? `Completed ${formatShortDate(obj.completed_at)}` : formatShortDate(obj.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
