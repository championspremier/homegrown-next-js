import { redirect } from "next/navigation";
import { getAuthUserWithProfile } from "@/lib/auth";
import { getRoleHome } from "@/lib/role";

export default async function DashboardPage() {
  const result = await getAuthUserWithProfile();
  if (!result) redirect("/login");
  const { profile } = result;
  if (!profile) redirect("/login");
  redirect(getRoleHome(profile.role ?? "parent"));
}
