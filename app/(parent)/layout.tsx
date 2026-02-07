import { requireActiveRole } from "@/lib/auth";
import { getLinkedAccounts } from "@/app/actions/account";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppShell } from "@/components/layout/AppShell";

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

  return (
    <AppShell
      navItems={getNavItemsForRole(activeProfile.role ?? "parent")}
      roleHome={getRoleHome(activeProfile.role ?? "parent")}
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
