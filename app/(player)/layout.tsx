import { requireActiveRole } from "@/lib/auth";
import { getLinkedAccounts } from "@/app/actions/account";
import { getNavItemsForRole, getRoleHome } from "@/lib/role";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getProgramBranding } from "@/lib/get-program-branding";
import { getPlanAccessForPlayer } from "@/lib/plan-access";
import { getSessionUsage } from "@/lib/session-usage";
import { PlanAccessProvider } from "@/components/plan-gate/PlanAccessContext";
import { getActiveProfileIdFromCookies } from "@/lib/active-profile";

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, activeProfile } = await requireActiveRole("player");
  const effectivePlayerId = (await getActiveProfileIdFromCookies()) ?? user.id;
  const supabase = await createClient();
  let planAccess = await getPlanAccessForPlayer(effectivePlayerId);
  if (planAccess.hasPlan && planAccess.billingStartDate) {
    const sessionUsage = await getSessionUsage(supabase as any, effectivePlayerId, planAccess.billingStartDate);
    planAccess = { ...planAccess, sessionUsage };
  }
  console.log("[Player layout] effectivePlayerId:", effectivePlayerId, "planAccess.hasPlan:", planAccess.hasPlan);
  const linkedResult = await getLinkedAccounts();
  const self = linkedResult?.self ?? { id: user.id, full_name: profile.full_name ?? null, email: profile.email ?? null, role: profile.role ?? "player" };
  const linked = linkedResult?.linked ?? [];

  const activeForSwitcher = {
    id: activeProfile.id,
    full_name: activeProfile.full_name ?? null,
    email: activeProfile.email ?? null,
    role: activeProfile.role ?? "player",
  };

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

  const branding = await getProgramBranding(supabase, activeProfile.id);

  return (
    <PlanAccessProvider planAccess={planAccess} profileId={activeProfile.id}>
      <AppShell
        navItems={getNavItemsForRole(activeProfile.role ?? "player")}
        roleHome={getRoleHome(activeProfile.role ?? "player")}
        profilePhotoUrl={profilePhotoUrl}
        branding={branding}
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
    </PlanAccessProvider>
  );
}
