import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import SoloCreateClient from "./solo-create-client";

export const dynamic = "force-dynamic";

export default async function AdminSoloCreatePage() {
  await requireRole("admin");
  const supabase = await createClient();

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
    <SoloCreateClient
      sessions={sessions ?? []}
      videos={videos ?? []}
      thumbnails={thumbnails ?? []}
    />
  );
}
