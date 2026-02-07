import { redirect } from "next/navigation";
import { getAuthUserWithProfile } from "@/lib/auth";
import { getActiveProfile } from "@/lib/active-profile";
import { getLinkedAccounts } from "@/app/actions/account";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getAuthUserWithProfile();
  if (!result) redirect("/login");
  const { user, profile } = result;
  if (!profile) redirect("/login");

  let activeProfile = await getActiveProfile();
  if (!activeProfile) {
    activeProfile = {
      id: profile.id,
      full_name: profile.full_name ?? null,
      email: profile.email ?? null,
      role: profile.role ?? "parent",
    };
  }

  const linkedResult = await getLinkedAccounts();
  const self = linkedResult?.self ?? {
    id: user.id,
    full_name: profile.full_name ?? null,
    email: profile.email ?? null,
    role: profile.role ?? "parent",
  };
  const linked = linkedResult?.linked ?? [];

  const activeForSwitcher = {
    id: activeProfile.id,
    full_name: activeProfile.full_name ?? null,
    email: activeProfile.email ?? null,
    role: activeProfile.role ?? "parent",
  };

  return (
    <AppShell
      navItems={getNavItemsForRole(activeProfile.role ?? "parent")}
      roleHome={getRoleHome(activeProfile.role ?? "parent")}
      topbarRight={
        <AccountSwitcher
          activeProfile={activeForSwitcher}
          self={self}
          linked={linked}
        />
      }
    >
      {children}
    </AppShell>
  );
}
