import { requireRole } from "@/lib/auth";
import PlansClient from "./plans-client";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const { profile } = await requireRole("admin");

  return <PlansClient profileId={profile.id} />;
}
