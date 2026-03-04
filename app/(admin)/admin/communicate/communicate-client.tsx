"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Send, Search, X, Check, Plus, Trash2, Target, HelpCircle, MessageSquare, Info, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./communicate.module.css";

/* ─── Types ─── */

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  positions: string[] | null;
}

interface Message {
  id: string;
  message_text: string;
  recipient_type: string;
  announcement_type: string;
  created_at: string;
  coach_name: string;
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  period: string | null;
  category: string | null;
  created_at: string;
}

interface Props {
  coachId: string;
  players: Player[];
  messages: Message[];
  recentQuizzes: Quiz[];
}

const RECIPIENT_TYPES = [
  { value: "all", label: "All" },
  { value: "players", label: "Players" },
  { value: "parents", label: "Parents" },
  { value: "coaches", label: "Coaches" },
  { value: "admins", label: "Admins" },
];

const ANNOUNCEMENT_TYPES = [
  { value: "information", label: "Information" },
  { value: "time_change", label: "Time Change" },
  { value: "cancellation", label: "Cancellation" },
  { value: "popup_session", label: "Additional Session" },
  { value: "veo_link", label: "Veo Link" },
  { value: "merch", label: "Merch" },
];

const PERIODS = [
  { value: "build-out", label: "Build-Out" },
  { value: "middle-third", label: "Middle Third" },
  { value: "final-third", label: "Final Third" },
  { value: "wide-play", label: "Wide Play" },
  { value: "general", label: "General" },
];

const CATEGORIES = [
  { value: "technical", label: "Technical" },
  { value: "physical", label: "Physical" },
  { value: "mental", label: "Mental" },
  { value: "tactical", label: "Tactical" },
  { value: "game-iq", label: "Game IQ" },
];

/* ─── Position abbreviations ─── */
const POSITION_ABBR: Record<string, string> = {
  goalkeeper: "GK",
  gk: "GK",
  "central defender": "CB",
  cb: "CB",
  "center back": "CB",
  "mid-defensive": "CDM",
  cdm: "CDM",
  "defensive midfielder": "CDM",
  "mid-offensive": "CAM",
  cam: "CAM",
  "attacking midfielder": "CAM",
  winger: "W",
  w: "W",
  "full-back": "FB",
  fb: "FB",
  "full back": "FB",
  forward: "FW",
  fw: "FW",
  striker: "FW",
};

function abbreviatePosition(pos: string): string {
  return POSITION_ABBR[pos.toLowerCase()] || pos;
}

/* ─── Curriculum focus schedule ─── */
function getCurrentCurriculumFocus(): string {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  if (m === 1 || (m === 2 && d <= 14)) return "BUILD-OUT";
  if ((m === 2 && d >= 15) || m === 3) return "FINAL THIRD";
  if (m === 4 || (m === 5 && d <= 15)) return "MIDDLE THIRD";
  if ((m === 5 && d >= 16) || m === 6) return "WIDE PLAY";
  if (m === 7 || (m === 8 && d <= 15)) return "11V11 FORMATIONS";
  if ((m === 8 && d >= 16) || m === 9) return "SET PIECES";
  if (m === 10 && d <= 15) return "BUILD-OUT";
  if (m === 10 && d >= 16) return "FINAL THIRD";
  if (m === 11 && d <= 15) return "MIDDLE THIRD";
  if (m === 11 && d >= 16) return "WIDE PLAY";
  // December: weekly rotation
  const weekOfMonth = Math.ceil(d / 7);
  const rotation = ["BUILD-OUT", "FINAL THIRD", "MIDDLE THIRD", "WIDE PLAY"];
  return rotation[(weekOfMonth - 1) % 4];
}

/* ─── Announcement type display helpers ─── */
function announcementLabel(type: string): string {
  return ANNOUNCEMENT_TYPES.find((a) => a.value === type)?.label || type;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Component ─── */

export default function CommunicateClient({ coachId, players, messages: initialMessages, recentQuizzes }: Props) {
  const supabase = createClient();

  /* ─── Messages state ─── */
  const [messageText, setMessageText] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(["all"]);
  const [announcementType, setAnnouncementType] = useState("information");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messageList, setMessageList] = useState<Message[]>(initialMessages);
  const [msgRemaining, setMsgRemaining] = useState<number | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Objectives state ─── */
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inPossession, setInPossession] = useState("");
  const [outOfPossession, setOutOfPossession] = useState("");
  const [currentObjective, setCurrentObjective] = useState<{
    in_possession_objective: string;
    out_of_possession_objective: string;
  } | null>(null);
  const [loadingObj, setLoadingObj] = useState(false);
  const [sendingObj, setSendingObj] = useState(false);
  const [showCppInfo, setShowCppInfo] = useState(false);
  const cppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Quiz state ─── */
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState<string[]>(["", ""]);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [quizPeriod, setQuizPeriod] = useState("");
  const [quizCategory, setQuizCategory] = useState("");
  const [sendingQuiz, setSendingQuiz] = useState(false);

  /* ─── Toast ─── */
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const currentFocus = useMemo(() => getCurrentCurriculumFocus(), []);

  /* ─── CPP info auto-dismiss ─── */
  useEffect(() => {
    if (showCppInfo) {
      cppTimerRef.current = setTimeout(() => setShowCppInfo(false), 5000);
      return () => { if (cppTimerRef.current) clearTimeout(cppTimerRef.current); };
    }
  }, [showCppInfo]);

  /* ─── Message rate limit ─── */
  useEffect(() => {
    const fetchCount = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from("coach_messages")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .gte("created_at", todayStart.toISOString());
      setMsgRemaining(Math.max(0, 3 - (count || 0)));
    };
    fetchCount();
  }, [coachId, supabase]);

  /* ─── Filtered players for search ─── */
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return [];
    const q = playerSearch.toLowerCase();
    return players.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [playerSearch, players]);

  /* ─── Recipient toggle ─── */
  const toggleRecipient = useCallback((value: string) => {
    if (value === "all") {
      setSelectedRecipients(["all"]);
      return;
    }
    setSelectedRecipients((prev) => {
      let next = prev.filter((r) => r !== "all");
      if (next.includes(value)) {
        next = next.filter((r) => r !== value);
      } else {
        next = [...next, value];
      }
      if (next.length === 0) next = ["all"];
      const nonAll = ["players", "parents", "coaches", "admins"];
      if (nonAll.every((r) => next.includes(r))) next = ["all"];
      return next;
    });
  }, []);

  /* ─── Message handlers ─── */
  const handleSendMessage = async () => {
    if (sendingMsg) return;
    if (messageText.trim().length < 3) {
      showToast("Message too short");
      return;
    }
    if (msgRemaining !== null && msgRemaining <= 0) {
      showToast("Daily message limit reached");
      return;
    }
    setSendingMsg(true);
    try {
      let attachmentPayload: Record<string, unknown> = {};
      if (attachment) {
        const filePath = `${coachId}/${Date.now()}-${attachment.name}`;
        const { error: uploadErr } = await (supabase as any).storage
          .from("message-attachments")
          .upload(filePath, attachment);
        if (!uploadErr) {
          const { data: urlData } = (supabase as any).storage
            .from("message-attachments")
            .getPublicUrl(filePath);
          attachmentPayload = {
            attachment_url: urlData.publicUrl,
            attachment_name: attachment.name,
            attachment_size: attachment.size,
          };
        }
      }

      const types = selectedRecipients.includes("all") ? ["all"] : selectedRecipients;

      for (const rt of types) {
        const { error } = await (supabase as any).from("coach_messages").insert({
          coach_id: coachId,
          message_text: messageText.trim(),
          recipient_type: rt,
          announcement_type: announcementType,
          is_active: true,
          ...attachmentPayload,
        });
        if (error) throw error;
      }

      /* ── Create notifications (deduped by recipient) ── */
      const recipientIds = new Set<string>();
      const recipientEntries: { id: string; role: string }[] = [];

      const effectiveTypes = selectedRecipients.includes("all")
        ? ["players", "parents", "coaches", "admins"]
        : selectedRecipients;

      for (const rt of effectiveTypes) {
        if (rt === "players") {
          for (const p of players) {
            if (!recipientIds.has(p.id)) {
              recipientIds.add(p.id);
              recipientEntries.push({ id: p.id, role: "player" });
            }
          }
        } else if (rt === "parents") {
          const { data: parentRels } = await (supabase as any)
            .from("parent_player_relationships")
            .select("parent_id");
          const uniqueParentIds = Array.from(new Set((parentRels || []).map((r: { parent_id: string }) => r.parent_id))) as string[];
          for (const pid of uniqueParentIds) {
            if (!recipientIds.has(pid)) {
              recipientIds.add(pid);
              recipientEntries.push({ id: pid, role: "parent" });
            }
          }
        } else if (rt === "coaches") {
          const { data: coaches } = await (supabase as any)
            .from("profiles")
            .select("id")
            .eq("role", "coach");
          for (const c of coaches || []) {
            if (!recipientIds.has(c.id)) {
              recipientIds.add(c.id);
              recipientEntries.push({ id: c.id, role: "coach" });
            }
          }
        } else if (rt === "admins") {
          const { data: admins } = await (supabase as any)
            .from("profiles")
            .select("id")
            .eq("role", "admin");
          for (const a of admins || []) {
            if (!recipientIds.has(a.id)) {
              recipientIds.add(a.id);
              recipientEntries.push({ id: a.id, role: "admin" });
            }
          }
        }
      }

      if (recipientEntries.length > 0) {
        const msgPreview = messageText.trim().substring(0, 100);
        const notifRows = recipientEntries.map((r) => ({
          recipient_id: r.id,
          recipient_role: r.role,
          notification_type: announcementType,
          title: "New Announcement",
          message: msgPreview,
          is_read: false,
          data: {},
        }));
        await (supabase as any).from("notifications").insert(notifRows);
      }

      const displayType = types.length === 1 ? types[0] : types.join(", ");
      setMessageList((prev) => [
        {
          id: crypto.randomUUID(),
          message_text: messageText.trim(),
          recipient_type: displayType,
          announcement_type: announcementType,
          created_at: new Date().toISOString(),
          coach_name: "You",
        },
        ...prev,
      ]);
      setMessageText("");
      setAttachment(null);
      setAttachmentPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMsgRemaining((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
      showToast("Message sent!");
    } catch (err) {
      console.error("Failed to send message:", err);
      showToast("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  };

  /* ─── Objectives handlers ─── */
  const handleSelectPlayer = async (player: Player) => {
    setSelectedPlayer(player);
    setPlayerSearch("");
    setInPossession("");
    setOutOfPossession("");
    setCurrentObjective(null);
    setLoadingObj(true);

    try {
      const { data } = await (supabase as any)
        .from("player_objectives")
        .select("in_possession_objective, out_of_possession_objective")
        .eq("player_id", player.id)
        .eq("is_active", true)
        .maybeSingle();
      if (data) setCurrentObjective(data);
    } catch { /* */ }
    setLoadingObj(false);
  };

  const handleSendObjectives = async () => {
    if (!selectedPlayer || (!inPossession.trim() && !outOfPossession.trim()) || sendingObj) return;
    setSendingObj(true);
    try {
      await (supabase as any)
        .from("player_objectives")
        .update({ is_active: false, completed_at: new Date().toISOString() })
        .eq("player_id", selectedPlayer.id)
        .eq("is_active", true);

      const { data: objectiveRow, error } = await (supabase as any)
        .from("player_objectives")
        .insert({
          player_id: selectedPlayer.id,
          coach_id: coachId,
          in_possession_objective: inPossession.trim() || null,
          out_of_possession_objective: outOfPossession.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;

      const now = new Date();
      const quarterYear = now.getFullYear();
      const quarterNumber = Math.ceil((now.getMonth() + 1) / 3);

      await Promise.all([
        (supabase as any).from("notifications").insert({
          recipient_id: selectedPlayer.id,
          recipient_role: "player",
          notification_type: "objectives_assigned",
          title: "New Objectives",
          message: "Your coach has set new objectives for you.",
          is_read: false,
          data: {},
        }),
        (supabase as any).from("points_transactions").insert({
          player_id: selectedPlayer.id,
          points: 0.1,
          session_type: "HG_OBJECTIVE",
          session_id: objectiveRow.id,
          quarter_year: quarterYear,
          quarter_number: quarterNumber,
          checked_in_at: now.toISOString(),
          checked_in_by: coachId,
          status: "active",
        }),
      ]);

      setCurrentObjective({
        in_possession_objective: inPossession.trim(),
        out_of_possession_objective: outOfPossession.trim(),
      });
      setInPossession("");
      setOutOfPossession("");
      showToast(`Objectives sent to ${selectedPlayer.first_name}!`);
    } catch (err) {
      console.error("Failed to send objectives:", err);
      showToast("Failed to send objectives");
    } finally {
      setSendingObj(false);
    }
  };

  /* ─── Quiz handlers ─── */
  const handleAddOption = () => {
    if (quizOptions.length >= 6) return;
    setQuizOptions((prev) => [...prev, ""]);
  };

  const handleRemoveOption = (idx: number) => {
    if (quizOptions.length <= 2) return;
    setQuizOptions((prev) => prev.filter((_, i) => i !== idx));
    if (correctAnswer === idx) setCorrectAnswer(null);
    else if (correctAnswer !== null && correctAnswer > idx) setCorrectAnswer(correctAnswer - 1);
  };

  const handleSendQuiz = async () => {
    if (sendingQuiz) return;
    if (quizQuestion.trim().length < 5) {
      showToast("Question must be at least 5 characters");
      return;
    }
    const filledOptions = quizOptions.filter((o) => o.trim());
    if (filledOptions.length < 2) {
      showToast("Need at least 2 answer options");
      return;
    }
    if (correctAnswer === null || correctAnswer >= filledOptions.length) {
      showToast("Select a correct answer");
      return;
    }
    if (!window.confirm(`Send this quiz to ${players.length} players?`)) return;
    setSendingQuiz(true);
    try {
      const { data: quizRow, error: quizErr } = await (supabase as any)
        .from("quiz_questions")
        .insert({
          question: quizQuestion.trim(),
          options: filledOptions,
          correct_answer: correctAnswer,
          period: quizPeriod || null,
          category: quizCategory || null,
          coach_id: coachId,
          is_active: true,
        })
        .select("id")
        .single();
      if (quizErr) throw quizErr;

      const assignments = players.map((p) => ({
        quiz_question_id: quizRow.id,
        player_id: p.id,
        status: "assigned",
      }));
      if (assignments.length > 0) {
        await (supabase as any).from("quiz_assignments").insert(assignments);
      }

      const notifications = players.map((p) => ({
        recipient_id: p.id,
        recipient_role: "player",
        notification_type: "quiz_assigned",
        title: "New Quiz",
        message: "Your coach sent a new quiz question.",
        is_read: false,
        data: { quiz_question_id: quizRow.id },
      }));
      if (notifications.length > 0) {
        await (supabase as any).from("notifications").insert(notifications);
      }

      setQuizQuestion("");
      setQuizOptions(["", ""]);
      setCorrectAnswer(null);
      setQuizPeriod("");
      setQuizCategory("");
      showToast(`Quiz sent to ${players.length} players!`);
    } catch (err) {
      console.error("Failed to send quiz:", err);
      showToast("Failed to send quiz");
    } finally {
      setSendingQuiz(false);
    }
  };

  /* ─── Position pills helper ─── */
  const renderPositions = (positions: string[] | null, variant: "muted" | "pill" = "pill") => {
    if (!positions?.length) return null;
    if (variant === "muted") {
      return (
        <span className={styles.positionsMuted}>
          {positions.map(abbreviatePosition).join(", ")}
        </span>
      );
    }
    return (
      <span className={styles.positionPills}>
        {positions.map((pos, i) => (
          <span key={i} className={styles.positionPill}>{abbreviatePosition(pos)}</span>
        ))}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      {/* ─── Messages ─── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <MessageSquare size={20} />
          Messages
        </h2>
        <div className={styles.messageComposer}>
          <textarea
            className={styles.messageInput}
            placeholder="Write a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={3}
          />
          <div className={styles.messageActions}>
            <div className={styles.recipientPills}>
              {RECIPIENT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  className={`${styles.recipientPill} ${selectedRecipients.includes(rt.value) ? styles.recipientPillActive : ""}`}
                  onClick={() => toggleRecipient(rt.value)}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
          {attachmentPreview && (
            <div className={styles.attachmentPreview}>
              <img src={attachmentPreview} alt="attachment" className={styles.attachmentThumb} />
              <button
                type="button"
                className={styles.removeAttachBtn}
                onClick={() => {
                  setAttachment(null);
                  setAttachmentPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className={styles.messageActions}>
            <select
              className={styles.announcementSelect}
              value={announcementType}
              onChange={(e) => setAnnouncementType(e.target.value)}
            >
              {ANNOUNCEMENT_TYPES.map((at) => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
            >
              <ImageIcon size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setAttachment(file);
                  setAttachmentPreview(URL.createObjectURL(file));
                }
              }}
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSendMessage}
              disabled={messageText.trim().length < 3 || sendingMsg || msgRemaining === 0}
            >
              <Send size={16} />
              {sendingMsg ? "Sending..." : "Send"}
            </button>
            {msgRemaining !== null && (
              <span className={styles.rateLimitHint}>
                {msgRemaining} message{msgRemaining !== 1 ? "s" : ""} remaining today
              </span>
            )}
          </div>
        </div>

        {messageList.length > 0 && (
          <div className={styles.messageHistory}>
            {messageList.map((m) => (
              <div key={m.id} className={styles.messageCard}>
                <div className={styles.messageCardTop}>
                  <span className={styles.messageCoach}>{m.coach_name}</span>
                  <div className={styles.messageBadges}>
                    <span className={styles.announceBadge} data-atype={m.announcement_type}>
                      {announcementLabel(m.announcement_type)}
                    </span>
                    <span className={styles.messageBadge} data-type={m.recipient_type}>
                      {m.recipient_type}
                    </span>
                  </div>
                </div>
                <p className={styles.messageText}>{m.message_text}</p>
                <span className={styles.messageTime}>{timeAgo(m.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Grid: Objectives + Quiz ─── */}
      <div className={styles.gridRow}>
        {/* ─── Objectives ─── */}
        <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>
              <Target size={20} />
              Player Objectives
            </h2>
            <div className={styles.infoWrap}>
              <button
                type="button"
                className={styles.infoBtn}
                onClick={() => setShowCppInfo((v) => !v)}
                aria-label="CPP info"
              >
                <Info size={16} />
              </button>
              {showCppInfo && (
                <div className={styles.infoTooltip}>
                  Objectives should be sent once per week, after a CPP 2+. The first CPP session
                  should focus on analyzing the player&apos;s in-game metrics. Ask an admin if you
                  have questions.
                </div>
              )}
            </div>
          </div>

          <div className={styles.curriculumBanner}>
            <span className={styles.curriculumLabel}>Current Focus:</span>
            <span className={styles.curriculumPeriod}>{currentFocus}</span>
          </div>

          {/* Player search */}
          <div className={styles.playerSearchWrap}>
            {selectedPlayer ? (
              <div className={styles.selectedPlayer}>
                <span className={styles.selectedPlayerName}>
                  {selectedPlayer.first_name} {selectedPlayer.last_name}
                  {renderPositions(selectedPlayer.positions, "muted")}
                </span>
                <button
                  type="button"
                  className={styles.removePlayerBtn}
                  onClick={() => { setSelectedPlayer(null); setCurrentObjective(null); }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className={styles.searchInputWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Search player..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                />
              </div>
            )}
            {filteredPlayers.length > 0 && !selectedPlayer && (
              <div className={styles.searchResults}>
                {filteredPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.searchResultItem}
                    onClick={() => handleSelectPlayer(p)}
                  >
                    <span>{p.first_name} {p.last_name}</span>
                    {renderPositions(p.positions)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlayer && (
            <div className={styles.objectivesForm}>
              {loadingObj ? (
                <p className={styles.loadingText}>Loading...</p>
              ) : (
                <>
                  {currentObjective && (
                    <div className={styles.currentObjectives}>
                      <span className={styles.currentLabel}>Current Objectives</span>
                      {currentObjective.in_possession_objective && (
                        <p className={styles.currentText}>
                          <strong>In Possession:</strong> {currentObjective.in_possession_objective}
                        </p>
                      )}
                      {currentObjective.out_of_possession_objective && (
                        <p className={styles.currentText}>
                          <strong>Out of Possession:</strong> {currentObjective.out_of_possession_objective}
                        </p>
                      )}
                    </div>
                  )}
                  <label className={styles.fieldLabel}>In Possession</label>
                  <textarea
                    className={styles.objectiveTextarea}
                    placeholder="e.g. Drive into the final third with more confidence..."
                    value={inPossession}
                    onChange={(e) => setInPossession(e.target.value)}
                  />
                  <label className={styles.fieldLabel}>Out of Possession</label>
                  <textarea
                    className={styles.objectiveTextarea}
                    placeholder="e.g. Press higher up the pitch when defending..."
                    value={outOfPossession}
                    onChange={(e) => setOutOfPossession(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.sendBtn}
                    onClick={handleSendObjectives}
                    disabled={(!inPossession.trim() && !outOfPossession.trim()) || sendingObj}
                  >
                    <Send size={16} />
                    {sendingObj ? "Sending..." : "Send Objectives"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* ─── Quiz ─── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <HelpCircle size={20} />
            Quiz Creator
          </h2>

          <label className={styles.fieldLabel}>Question</label>
          <textarea
            className={styles.objectiveTextarea}
            placeholder="What is the primary role of a #6 in build-out?"
            value={quizQuestion}
            onChange={(e) => setQuizQuestion(e.target.value)}
          />

          <label className={styles.fieldLabel}>Answer Options</label>
          <div className={styles.quizOptionsList}>
            {quizOptions.map((opt, i) => (
              <div key={i} className={styles.quizOptionRow}>
                <span className={styles.optionLabel}>{String.fromCharCode(65 + i)}</span>
                <input
                  className={styles.optionInput}
                  type="text"
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  value={opt}
                  onChange={(e) => {
                    const next = [...quizOptions];
                    next[i] = e.target.value;
                    setQuizOptions(next);
                  }}
                />
                <button
                  type="button"
                  className={`${styles.correctBtn} ${correctAnswer === i ? styles.correctBtnActive : ""}`}
                  onClick={() => setCorrectAnswer(i)}
                  title="Mark as correct"
                >
                  <Check size={16} />
                </button>
                {quizOptions.length > 2 && (
                  <button
                    type="button"
                    className={styles.removeOptBtn}
                    onClick={() => handleRemoveOption(i)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {quizOptions.length < 6 && (
            <button type="button" className={styles.addOptionBtn} onClick={handleAddOption}>
              <Plus size={14} /> Add Option
            </button>
          )}

          <div className={styles.quizMeta}>
            <div className={styles.quizMetaField}>
              <label className={styles.fieldLabel}>Period</label>
              <select
                className={styles.metaSelect}
                value={quizPeriod}
                onChange={(e) => setQuizPeriod(e.target.value)}
              >
                <option value="">None</option>
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.quizMetaField}>
              <label className={styles.fieldLabel}>Category</label>
              <select
                className={styles.metaSelect}
                value={quizCategory}
                onChange={(e) => setQuizCategory(e.target.value)}
              >
                <option value="">None</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className={`${styles.sendBtn} ${styles.quizSendBtn}`}
            onClick={handleSendQuiz}
            disabled={quizQuestion.trim().length < 5 || correctAnswer === null || sendingQuiz}
          >
            <Send size={16} />
            {sendingQuiz ? "Sending..." : `Send Quiz to ${players.length} Players`}
          </button>

          {recentQuizzes.length > 0 && (
            <div className={styles.quizHistory}>
              <h3 className={styles.historyTitle}>Recent Quizzes</h3>
              {recentQuizzes.map((q) => (
                <div key={q.id} className={styles.quizHistoryCard}>
                  <p className={styles.quizHistoryQ}>{q.question}</p>
                  <div className={styles.quizHistoryMeta}>
                    {q.category && <span className={styles.quizMetaBadge}>{q.category}</span>}
                    {q.period && <span className={styles.quizMetaBadge}>{q.period}</span>}
                    <span className={styles.messageTime}>{timeAgo(q.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
