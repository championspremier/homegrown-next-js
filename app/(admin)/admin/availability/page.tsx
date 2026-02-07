import { createClient } from "@/lib/supabase/server";
import { AvailabilityManager } from "./availability-manager";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ coach?: string }> | { coach?: string };

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createClient();

  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "coach")
    .order("full_name", { nullsFirst: false });

  const coaches = (coachesData ?? []).map((c: { id: string; full_name: string | null; email: string | null }) => ({
    id: c.id,
    full_name: c.full_name ?? null,
    email: c.email ?? null,
  }));

  const resolved = searchParams && typeof (searchParams as Promise<unknown>).then === "function"
    ? await (searchParams as Promise<{ coach?: string }>)
    : (searchParams as { coach?: string }) ?? {};
  const coachParam = resolved.coach;
  const selectedCoachId =
    coachParam && coaches.some((c) => c.id === coachParam)
      ? coachParam
      : coaches[0]?.id ?? null;

  let availability: { id: string; day_of_week: number; start_time: string; end_time: string; created_at: string }[] = [];
  if (selectedCoachId) {
    const { data: rows } = await supabase
      .from("coach_availability")
      .select("id, day_of_week, start_time, end_time, created_at")
      .eq("coach_id", selectedCoachId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    availability = (rows ?? []).map((r) => ({
      id: r.id,
      day_of_week: r.day_of_week,
      start_time: typeof r.start_time === "string" ? r.start_time : String(r.start_time),
      end_time: typeof r.end_time === "string" ? r.end_time : String(r.end_time),
      created_at: r.created_at,
    }));
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Availability</h1>
      <p className={styles.muted}>
        Manage coach availability by day and time. Only admins can edit.
      </p>
      <AvailabilityManager
        coaches={coaches}
        selectedCoachId={selectedCoachId}
        availability={availability}
      />
    </div>
  );
}
