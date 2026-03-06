import { requireRole } from "@/lib/auth";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import NotificationBell from "@/components/notifications/NotificationBell";
import { getProgramBranding } from "@/lib/get-program-branding";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireRole("coach");

  const supabase = await createClient();
  const { data: photoFiles } = await supabase.storage
    .from("profile-photos")
    .list(profile.id, { limit: 1, search: "avatar" });
  let profilePhotoUrl: string | null = null;
  if (photoFiles && photoFiles.length > 0) {
    const { data: photoData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(`${profile.id}/${photoFiles[0].name}`);
    profilePhotoUrl = photoData?.publicUrl || null;
  }

  const branding = await getProgramBranding(supabase, profile.id);

  return (
    <AppShell
      navItems={getNavItemsForRole("coach")}
      roleHome={getRoleHome("coach")}
      profilePhotoUrl={profilePhotoUrl}
      mobileDrawer
      branding={branding}
      topbarRight={<NotificationBell userId={profile.id} role="coach" />}
    >
      {children}
    </AppShell>
  );
}
