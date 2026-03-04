"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell, BellOff, X, Target, HelpCircle, Trophy, Activity,
  Ban, AlarmClock, CalendarCheck, Info, Video, Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
}

interface Props {
  userId: string;
  role: "player" | "parent";
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
  };
  return titles[type] || fallback || "Notification";
}

function iconColorClass(type: string): string {
  if (type === "cancellation") return styles.iconRed;
  if (type === "popup_session" || type === "veo_link") return styles.iconGreen;
  if (type === "merch") return styles.iconBlue;
  if (type === "points_awarded" || type === "quiz_assigned") return styles.iconAccent;
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
    }));
  });
  const [loaded, setLoaded] = useState(!!initialNotifications);
  const sheetRef = useRef<HTMLDivElement>(null);

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
          .select("id, title, message, notification_type, is_read, created_at")
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
      }));

      const msgItems: NotifItem[] = (msgRes.data ?? []).map((m: Record<string, unknown>) => ({
        id: `msg-${m.id}`,
        title: null,
        message: m.message_text as string,
        notification_type: (m.announcement_type as string) || "information",
        is_read: true,
        created_at: m.created_at as string,
        source: "message" as const,
      }));

      // Merge and dedupe: notifications take priority, messages fill in
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
                items.map((notif) => (
                  <div
                    key={notif.id}
                    className={`${styles.item} ${!notif.is_read ? styles.itemUnread : ""}`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className={`${styles.icon} ${iconColorClass(notif.notification_type)}`}>
                      {getNotifIcon(notif.notification_type)}
                    </div>
                    <div className={styles.content}>
                      <span className={styles.itemTitle}>
                        {getNotifTitle(notif.notification_type, notif.title)}
                      </span>
                      {notif.message && (
                        <span className={styles.message}>{notif.message}</span>
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
                    {!notif.is_read && <div className={styles.dot} />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
