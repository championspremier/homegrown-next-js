import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/media";
import ProfileForm from "./profile-form";
import styles from "@/components/layout/layout.module.css";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("id", user.id)
    .single();
  const profile = profileData as { id: string; full_name: string | null; email: string | null; avatar_url: string | null } | null;

  let avatarSigned: string | null = null;
  if (profile?.avatar_url) {
    try {
      avatarSigned = await getSignedUrl("avatars", profile.avatar_url);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Profile</h1>
      <p className={styles.muted}>
        Update your profile and photo.
      </p>
      <ProfileForm
        userId={user.id}
        initialFullName={profile?.full_name ?? ""}
        initialEmail={profile?.email ?? ""}
        avatarSignedUrl={avatarSigned}
      />
    </div>
  );
}
