import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import ParentProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ParentProfilePage() {
  const { activeProfile } = await requireActiveRole("parent");
  const supabase = await createClient();
  const parentId = activeProfile.id;

  const { data: parentProfile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone_number")
    .eq("id", parentId)
    .single();

  // Fetch linked players
  const { data: relationships } = await supabase
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", parentId);

  const playerIds = (relationships || []).map(
    (r: Record<string, unknown>) => r.player_id as string
  );

  let linkedPlayers: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    birthYear: number | null;
  }[] = [];

  if (playerIds.length > 0) {
    const { data: playerProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, birth_year")
      .in("id", playerIds);

    linkedPlayers = (playerProfiles || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      firstName: (p.first_name as string) || "",
      lastName: (p.last_name as string) || "",
      email: (p.email as string) || "",
      birthYear: (p.birth_year as number) ?? null,
    }));
  }

  // Fetch Homegrown program (platform-level legal + socials)
  const { data: homegrownProgram } = await supabase
    .from("programs")
    .select(
      "id, terms_of_service_url, privacy_policy_url, social_facebook, social_instagram, social_tiktok, social_twitter, social_youtube, social_linkedin, contact_email"
    )
    .eq("slug", "homegrown")
    .single();

  const hg = homegrownProgram as Record<string, unknown> | null;

  // Fetch parent's on-field program (operational policies + socials)
  const { data: onFieldMembership } = await supabase
    .from("program_memberships")
    .select("program_id")
    .eq("profile_id", parentId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const membershipProgramId = (onFieldMembership as Record<string, unknown> | null)?.program_id as string | null;
  let onFieldProgram: Record<string, unknown> | null = null;

  if (membershipProgramId && membershipProgramId !== (hg?.id as string | undefined)) {
    const { data } = await supabase
      .from("programs")
      .select(
        "name, cancellation_policy, refund_policy, terms_of_service_url, privacy_policy_url, social_facebook, social_instagram, social_tiktok, social_twitter, social_youtube, social_linkedin, contact_email"
      )
      .eq("id", membershipProgramId)
      .single();
    onFieldProgram = data as Record<string, unknown> | null;
  }

  const pp = parentProfile as Record<string, unknown> | null;

  return (
    <ParentProfileClient
      parentId={parentId}
      parentProfile={{
        firstName: (pp?.first_name as string) || "",
        lastName: (pp?.last_name as string) || "",
        email: (pp?.email as string) || "",
        phone: (pp?.phone_number as string) || "",
      }}
      linkedPlayers={linkedPlayers}
      homegrownProgram={{
        termsUrl: (hg?.terms_of_service_url as string) || null,
        privacyUrl: (hg?.privacy_policy_url as string) || null,
        contactEmail: (hg?.contact_email as string) || null,
        socials: {
          facebook: (hg?.social_facebook as string) || null,
          instagram: (hg?.social_instagram as string) || null,
          tiktok: (hg?.social_tiktok as string) || null,
          twitter: (hg?.social_twitter as string) || null,
          youtube: (hg?.social_youtube as string) || null,
          linkedin: (hg?.social_linkedin as string) || null,
        },
      }}
      onFieldProgram={
        onFieldProgram
          ? {
              name: (onFieldProgram.name as string) || null,
              cancellationPolicy: (onFieldProgram.cancellation_policy as string) || null,
              refundPolicy: (onFieldProgram.refund_policy as string) || null,
              termsUrl: (onFieldProgram.terms_of_service_url as string) || null,
              privacyUrl: (onFieldProgram.privacy_policy_url as string) || null,
              contactEmail: (onFieldProgram.contact_email as string) || null,
              socials: {
                facebook: (onFieldProgram.social_facebook as string) || null,
                instagram: (onFieldProgram.social_instagram as string) || null,
                tiktok: (onFieldProgram.social_tiktok as string) || null,
                twitter: (onFieldProgram.social_twitter as string) || null,
                youtube: (onFieldProgram.social_youtube as string) || null,
                linkedin: (onFieldProgram.social_linkedin as string) || null,
              },
            }
          : null
      }
    />
  );
}
