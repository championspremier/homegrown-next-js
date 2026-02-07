import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePlayerIdServer } from "@/lib/active-player";
import { getPlayerDashboard, getLinkedPlayers } from "@/lib/db";
import { getSignedUrl } from "@/lib/media";
import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export default async function PlayerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activePlayerId = await getActivePlayerIdServer();
  const linkedPlayers = await getLinkedPlayers(user.id);
  const effectivePlayerId = activePlayerId ?? user.id;
  const isOwnProfile = effectivePlayerId === user.id;

  type ProfileRow = { id: string; full_name: string | null; email: string | null; avatar_url: string | null; role: string };
  const dashboard = await getPlayerDashboard(effectivePlayerId);
  if (!dashboard) {
    if (!isOwnProfile) notFound();
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role")
      .eq("id", user.id)
      .single();
    const profile = profileData as ProfileRow | null;
    if (!profile) notFound();
    let avatarSigned: string | null = null;
    if (profile.avatar_url) {
      try {
        avatarSigned = await getSignedUrl("avatars", profile.avatar_url);
      } catch {
        // ignore
      }
    }
    return (
      <div>
        <h1 className={styles.pageTitle}>Player</h1>
        <p className={styles.muted}>Your profile</p>
        <div className={styles.flexRow}>
          {avatarSigned && (
            <img
              src={avatarSigned}
              alt=""
              width={80}
              height={80}
              className={styles.avatarRound}
            />
          )}
          <div>
            <p><strong>{profile.full_name ?? profile.email ?? "—"}</strong></p>
            <p className={styles.mutedSmall}>{profile.role}</p>
          </div>
        </div>
        <p className={`${styles.mutedSmall} ${styles.marginTopLg}`}>
          <Link href="/dashboard/profile">Edit profile & photo</Link>
        </p>
      </div>
    );
  }

  let avatarSigned: string | null = null;
  if (dashboard.profile.avatar_url) {
    try {
      avatarSigned = await getSignedUrl("avatars", dashboard.profile.avatar_url);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Player</h1>
      <p className={styles.muted}>
        {isOwnProfile ? "Your profile" : `Viewing ${dashboard.profile.full_name ?? "player"}`}
      </p>
      <div className={styles.flexRow}>
        {avatarSigned && (
          <img
            src={avatarSigned}
            alt=""
            width={80}
            height={80}
            className={styles.avatarRound}
          />
        )}
        <div>
          <p><strong>{dashboard.profile.full_name ?? dashboard.profile.email ?? "—"}</strong></p>
          <p className={styles.mutedSmall}>{dashboard.profile.role}</p>
        </div>
      </div>
      <ul className={`${styles.listUnstyled} ${styles.marginTopLg}`}>
        <li>Upcoming group reservations: {dashboard.upcomingGroupCount}</li>
        <li>Upcoming individual sessions: {dashboard.upcomingIndividualCount}</li>
      </ul>
      <p className={styles.marginTop}>
        <Link href="/dashboard/bookings">View bookings</Link>
      </p>
    </div>
  );
}
