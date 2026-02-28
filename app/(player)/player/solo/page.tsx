import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/curriculum-period";
import SoloClient from "./solo-client";

export const dynamic = "force-dynamic";

export default async function PlayerSoloPage() {
  const { activeProfile } = await requireActiveRole("player");
  const supabase = await createClient();

  const currentPeriod = getCurrentPeriod();

  const { data: sessions } = await (supabase as any)
    .from("solo_sessions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const { data: videos } = await (supabase as any)
    .from("solo_session_videos")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: thumbnails } = await (supabase as any)
    .from("skill_thumbnails")
    .select("*");

  return (
    <SoloClient
      playerId={activeProfile.id}
      sessions={sessions ?? []}
      videos={videos ?? []}
      thumbnails={thumbnails ?? []}
      currentPeriod={currentPeriod}
    />
  );
}
