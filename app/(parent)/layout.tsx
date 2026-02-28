import { requireActiveRole } from "@/lib/auth";
import { getLinkedAccounts } from "@/app/actions/account";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, activeProfile } = await requireActiveRole("parent");
  const linkedResult = await getLinkedAccounts();
  const self = linkedResult?.self ?? { id: user.id, full_name: profile.full_name ?? null, email: profile.email ?? null, role: profile.role ?? "parent" };
  const linked = linkedResult?.linked ?? [];

  const activeForSwitcher = {
    id: activeProfile.id,
    full_name: activeProfile.full_name ?? null,
    email: activeProfile.email ?? null,
    role: activeProfile.role ?? "parent",
  };

  const supabase = await createClient();
  const { data: photoFiles } = await supabase.storage
    .from("profile-photos")
    .list(activeProfile.id, { limit: 1, search: "avatar" });
  let profilePhotoUrl: string | null = null;
  if (photoFiles && photoFiles.length > 0) {
    const { data: photoData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(`${activeProfile.id}/${photoFiles[0].name}`);
    profilePhotoUrl = photoData?.publicUrl || null;
  }

  return (
    <AppShell
      navItems={getNavItemsForRole(activeProfile.role ?? "parent")}
      roleHome={getRoleHome(activeProfile.role ?? "parent")}
      profilePhotoUrl={profilePhotoUrl}
      topbarRight={
        <AccountSwitcher
          activeProfile={activeForSwitcher}
          self={self}
          linked={linked ?? []}
        />
      }
    >
      {children}
    </AppShell>
  );
}
