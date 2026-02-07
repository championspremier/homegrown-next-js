import { requireRole } from "@/lib/auth";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AppShell } from "@/components/layout/AppShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");

  return (
    <AppShell
      navItems={getNavItemsForRole("admin")}
      roleHome={getRoleHome("admin")}
    >
      {children}
    </AppShell>
  );
}
