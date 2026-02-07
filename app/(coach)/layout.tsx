import { requireRole } from "@/lib/auth";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AppShell } from "@/components/layout/AppShell";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("coach");

  return (
    <AppShell
      navItems={getNavItemsForRole("coach")}
      roleHome={getRoleHome("coach")}
    >
      {children}
    </AppShell>
  );
}
