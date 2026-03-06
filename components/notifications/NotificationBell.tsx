"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, BellOff, X, Target, HelpCircle, Trophy, Activity,
  Ban, AlarmClock, CalendarCheck, Info, Video, Tag, Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { acceptProgramOffer } from "@/app/actions/offer-spot";
import { getProgramContactEmailByProgramId } from "@/app/actions/plan-gate";
import styles from "./NotificationBell.module.css";

/* ─── Types ─── */

interface NotifItem {
  id: string;
  title: string | null;
  message: string | null;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  source: "notification" | "message";
  data: Record<string, unknown> | null;
}

interface Props {
  userId: string;
  role: "player" | "parent" | "admin" | "coach";
  linkedPlayerIds?: string[];
  initialNotifications?: {
    id: string;
    title: string | null;
    message: string | null;
    notification_type: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    data: Record<string, unknown> | null;
  }[];
}

/* ─── Icon + title maps ─── */

function getNotifIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    objective_assigned: <Target size={20} />,
    quiz_assigned: <HelpCircle size={20} />,
    points_awarded: <Trophy size={20} />,
    solo_session_created: <Activity size={20} />,
    cancellation: <Ban size={20} />,
    time_change: <AlarmClock size={20} />,
    popup_session: <CalendarCheck size={20} />,
    information: <Info size={20} />,
    veo_link: <Video size={20} />,
    merch: <Tag size={20} />,
    announcement: <Info size={20} />,
    rating_request: <Star size={20} />,
  };
  return icons[type] || <Bell size={20} />;
}

function getNotifTitle(type: string, fallback?: string | null) {
  const titles: Record<string, string> = {
    objective_assigned: "New Objectives",
    quiz_assigned: "New Quiz",
    points_awarded: "Points Awarded",
    solo_session_created: "Solo Session",
    information: "Information",
    time_change: "Time Change",
    cancellation: "Cancellation",
    popup_session: "Additional Session",
    veo_link: "Veo Link",
    merch: "Merch",
    announcement: "Information",
    rating_request: "Rate a Player",
  };
  return titles[type] || fallback || "Notification";
}

function iconColorClass(type: string): string {
  if (type === "cancellation") return styles.iconRed;
  if (type === "popup_session" || type === "veo_link") return styles.iconGreen;
  if (type === "merch") return styles.iconBlue;
  if (type === "points_awarded" || type === "quiz_assigned") return styles.iconAccent;
  if (type === "rating_request") return styles.iconAmber;
  return "";
}

/* ─── Component ─── */

export default function NotificationBell({ userId, role, linkedPlayerIds, initialNotifications }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>(() => {
    if (!initialNotifications) return [];
    return initialNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      notification_type: n.notification_type,
      is_read: n.is_read,
      created_at: n.created_at,
      source: "notification" as const,
      data: n.data,
    }));
  });
  const [loaded, setLoaded] = useState(!!initialNotifications);
  const sheetRef = useRef<HTMLDivElement>(null);

  const [expandedRating, setExpandedRating] = useState<string | null>(null);
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
  const [offerAccepting, setOfferAccepting] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState<Set<string>>(new Set());
  const [ratingMaturity, setRatingMaturity] = useState(5);
  const [ratingSocially, setRatingSocially] = useState(5);
  const [ratingWorkEthic, setRatingWorkEthic] = useState(5);
  const [ratingNotes, setRatingNotes] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState<Set<string>>(new Set());

  const isCoachOrAdmin = role === "coach" || role === "admin";
  const unreadCount = items.filter((n) => !n.is_read).length;

  /* ─── Fetch notifications + coach messages on mount ─── */
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const supabase = createClient();
      const recipientIds = role === "parent" && linkedPlayerIds?.length
        ? [userId, ...linkedPlayerIds]
        : [userId];

      const [notifRes, msgRes] = await Promise.all([
        (supabase as any)
          .from("notifications")
          .select("id, title, message, notification_type, is_read, created_at, data")
          .in("recipient_id", recipientIds)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("coach_messages")
          .select("id, message_text, recipient_type, announcement_type, created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (cancelled) return;

      const notifItems: NotifItem[] = (notifRes.data ?? []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        title: n.title as string | null,
        message: n.message as string | null,
        notification_type: n.notification_type as string,
        is_read: n.is_read as boolean,
        created_at: n.created_at as string,
        source: "notification" as const,
        data: (n.data as Record<string, unknown>) || null,
      }));

      const msgItems: NotifItem[] = (msgRes.data ?? []).map((m: Record<string, unknown>) => ({
        id: `msg-${m.id}`,
        title: null,
        message: m.message_text as string,
        notification_type: (m.announcement_type as string) || "information",
        is_read: true,
        created_at: m.created_at as string,
        source: "message" as const,
        data: null,
      }));

      const seen = new Set(notifItems.map((n) => n.id));
      const merged = [...notifItems];
      for (const m of msgItems) {
        if (!seen.has(m.id)) merged.push(m);
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(merged);
      setLoaded(true);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [userId, role, linkedPlayerIds]);

  /* ─── Handlers ─── */

  const markAsRead = useCallback(async (notifId: string) => {
    if (notifId.startsWith("msg-")) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", notifId);

    setItems((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    const supabase = createClient();
    const unreadIds = items.filter((n) => !n.is_read && n.source === "notification").map((n) => n.id);
    if (unreadIds.length === 0) return;

    await (supabase as any)
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds);

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [items]);

  function handleExpandRating(notif: NotifItem) {
    if (expandedRating === notif.id) {
      setExpandedRating(null);
      return;
    }
    setExpandedRating(notif.id);
    setRatingMaturity(5);
    setRatingSocially(5);
    setRatingWorkEthic(5);
    setRatingNotes("");
  }

  function handleExpandOffer(notif: NotifItem) {
    if (expandedOffer === notif.id) {
      setExpandedOffer(null);
      return;
    }
    setExpandedOffer(notif.id);
    markAsRead(notif.id);
  }

  async function handleAcceptOffer(notif: NotifItem) {
    const offerId = notif.data?.offer_id as string | undefined;
    const programId = notif.data?.program_id as string | undefined;
    if (!offerId) return;
    setOfferAccepting(true);
    const result = await acceptProgramOffer(offerId);
    setOfferAccepting(false);
    if (result.ok) {
      setOfferAccepted((prev) => new Set(prev).add(offerId));
      const contactEmail = programId ? await getProgramContactEmailByProgramId(programId) : null;
      if (contactEmail) {
        window.location.href = `mailto:${contactEmail}?subject=Accepting%20my%20offer`;
      }
      alert("Contact your coach to complete enrollment.");
      setExpandedOffer(null);
    } else {
      alert(result.error || "Failed to accept offer");
    }
  }

  async function handleSubmitRating(notif: NotifItem) {
    if (!notif.data) return;
    setSubmittingRating(true);

    const supabase = createClient();
    const subId = notif.data.subscription_id as string;
    const playerId = notif.data.player_id as string;
    const programType = notif.data.program_type as string | null;

    await (supabase as any).from("coach_player_ratings").insert({
      subscription_id: subId,
      player_id: playerId,
      coach_id: userId,
      program_type: programType || null,
      maturity: ratingMaturity,
      socially: ratingSocially,
      work_ethic: ratingWorkEthic,
      notes: ratingNotes.trim() || null,
    });

    await (supabase as any)
      .from("plan_subscriptions")
      .update({ rating_completed: true })
      .eq("id", subId);

    await (supabase as any)
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("notification_type", "rating_request")
      .filter("data->>subscription_id", "eq", subId);

    setSubmittingRating(false);
    setRatingSubmitted((prev) => new Set(prev).add(subId));
    setExpandedRating(null);

    setItems((prev) =>
      prev.map((n) => {
        if (n.notification_type === "rating_request" && (n.data?.subscription_id as string) === subId) {
          return { ...n, is_read: true };
        }
        return n;
      })
    );
  }

  /* ─── Close on outside click ─── */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [isOpen]);

  if (!loaded && !initialNotifications) return null;

  return (
    <>
      {/* Bell trigger */}
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Bottom sheet / dropdown */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)}>
          <div
            ref={sheetRef}
            className={styles.sheet}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.handle} />
            <div className={styles.header}>
              <h3 className={styles.title}>Notifications</h3>
              <div className={styles.headerRight}>
                {unreadCount > 0 && (
                  <button type="button" className={styles.markAllBtn} onClick={markAllAsRead}>
                    Mark all read
                  </button>
                )}
                <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={styles.list}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <BellOff size={40} style={{ opacity: 0.4 }} />
                  <p>No notifications yet</p>
                </div>
              ) : (
                items.map((notif) => {
                  const isRatingRequest = notif.notification_type === "rating_request" && isCoachOrAdmin;
                  const isOfferNotif = !!(notif.data?.offer_id) && (role === "player" || role === "parent");
                  const offerId = notif.data?.offer_id as string | undefined;
                  const wasOfferAccepted = offerId ? offerAccepted.has(offerId) : false;
                  const subId = notif.data?.subscription_id as string | undefined;
                  const wasSubmitted = subId ? ratingSubmitted.has(subId) : false;
                  const isExpanded = expandedRating === notif.id;
                  const isOfferExpanded = expandedOffer === notif.id;

                  return (
                    <div key={notif.id} className={`${styles.item} ${!notif.is_read ? styles.itemUnread : ""}`}>
                      <div
                        className={styles.itemRow}
                        onClick={() => {
                          if (isOfferNotif && !wasOfferAccepted) {
                            handleExpandOffer(notif);
                          } else if (isRatingRequest && !wasSubmitted) {
                            handleExpandRating(notif);
                          } else if (!isOfferNotif) {
                            markAsRead(notif.id);
                          }
                        }}
                      >
                        <div className={`${styles.icon} ${iconColorClass(notif.notification_type)}`}>
                          {getNotifIcon(notif.notification_type)}
                        </div>
                        <div className={styles.content}>
                          <span className={styles.itemTitle}>
                            {getNotifTitle(notif.notification_type, notif.title)}
                          </span>
                          {wasSubmitted ? (
                            <span className={styles.ratingDone}>Rating submitted ✓</span>
                          ) : wasOfferAccepted ? (
                            <span className={styles.ratingDone}>Offer accepted ✓</span>
                          ) : (
                            notif.message && <span className={styles.message}>{notif.message}</span>
                          )}
                          <span className={styles.date}>
                            {new Date(notif.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {!notif.is_read && !wasSubmitted && !wasOfferAccepted && <div className={styles.dot} />}
                      </div>

                      {/* ─── Inline rating form ─── */}
                      {isRatingRequest && isExpanded && !wasSubmitted && (
                        <div className={styles.ratingForm}>
                          <p className={styles.ratingPlayer}>
                            {(notif.data?.player_name as string) || "Player"} — {(notif.data?.plan_name as string) || "Plan"}
                          </p>

                          <div className={styles.sliderGroup}>
                            <label className={styles.sliderLabel}>
                              Maturity <span className={styles.sliderValue}>{ratingMaturity}</span>
                            </label>
                            <input
                              type="range" min={1} max={10} step={1}
                              value={ratingMaturity}
                              onChange={(e) => setRatingMaturity(parseInt(e.target.value))}
                              className={styles.slider}
                            />
                          </div>

                          <div className={styles.sliderGroup}>
                            <label className={styles.sliderLabel}>
                              Socially <span className={styles.sliderValue}>{ratingSocially}</span>
                            </label>
                            <input
                              type="range" min={1} max={10} step={1}
                              value={ratingSocially}
                              onChange={(e) => setRatingSocially(parseInt(e.target.value))}
                              className={styles.slider}
                            />
                          </div>

                          <div className={styles.sliderGroup}>
                            <label className={styles.sliderLabel}>
                              Work Ethic <span className={styles.sliderValue}>{ratingWorkEthic}</span>
                            </label>
                            <input
                              type="range" min={1} max={10} step={1}
                              value={ratingWorkEthic}
                              onChange={(e) => setRatingWorkEthic(parseInt(e.target.value))}
                              className={styles.slider}
                            />
                          </div>

                          <textarea
                            className={styles.ratingNotes}
                            value={ratingNotes}
                            onChange={(e) => setRatingNotes(e.target.value)}
                            placeholder="Any additional notes..."
                            rows={2}
                          />

                          <button
                            type="button"
                            className={styles.ratingSubmitBtn}
                            onClick={() => handleSubmitRating(notif)}
                            disabled={submittingRating}
                          >
                            {submittingRating ? "Submitting..." : "Submit Rating"}
                          </button>
                        </div>
                      )}

                      {/* ─── Inline offer (DocSend links + Accept) ─── */}
                      {isOfferNotif && isOfferExpanded && !wasOfferAccepted && (
                        <div className={styles.ratingForm}>
                          <div className={styles.offerLinks}>
                            <a
                              href={(notif.data?.video_url as string) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.offerLinkBtn}
                            >
                              Watch Video
                            </a>
                            <a
                              href={(notif.data?.docsend_url as string) || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.offerLinkBtn}
                            >
                              Read DocSend
                            </a>
                          </div>
                          <p className={styles.offerPassword}>Password: Champion</p>
                          <button
                            type="button"
                            className={styles.ratingSubmitBtn}
                            onClick={() => handleAcceptOffer(notif)}
                            disabled={offerAccepting}
                          >
                            {offerAccepting ? "Accepting..." : "Accept Offer"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
