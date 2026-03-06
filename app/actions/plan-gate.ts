"use server";

import { createClient } from "@/lib/supabase/server";

export async function getProgramContactEmail(profileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: membership } = await (supabase as any)
    .from("program_memberships")
    .select("program_id, programs(contact_email)")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membership?.programs?.contact_email) return membership.programs.contact_email;

  const { data: rel } = await (supabase as any)
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", profileId)
    .limit(1)
    .maybeSingle();

  if (rel?.player_id) {
    const { data: playerMem } = await (supabase as any)
      .from("program_memberships")
      .select("program_id, programs(contact_email)")
      .eq("profile_id", rel.player_id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (playerMem?.programs?.contact_email) return playerMem.programs.contact_email;
  }

  return null;
}

export async function getProgramContactEmailByProgramId(programId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("programs")
    .select("contact_email")
    .eq("id", programId)
    .maybeSingle();
  return data?.contact_email ?? null;
}
