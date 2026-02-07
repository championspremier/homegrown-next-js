import { redirect } from "next/navigation";
import { getAuthUserWithProfile } from "@/lib/auth";
import { getRoleHome } from "@/lib/role";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["parent", "player", "coach", "admin"] as const;

export default async function WelcomePage() {
  const result = await getAuthUserWithProfile();
  if (!result) redirect("/login");

  const { profile } = result;
  const roleRaw = (profile?.role ?? "parent").toLowerCase().trim();
  const role = VALID_ROLES.includes(roleRaw as (typeof VALID_ROLES)[number]) ? roleRaw : "parent";

  redirect(`/api/active-profile/reset?to=${encodeURIComponent(getRoleHome(role))}`);
}
