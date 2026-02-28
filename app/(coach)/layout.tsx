import { requireRole } from "@/lib/auth";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <AppShell
      navItems={getNavItemsForRole("coach")}
      roleHome={getRoleHome("coach")}
      profilePhotoUrl={profilePhotoUrl}
    >
      {children}
    </AppShell>
  );
}
