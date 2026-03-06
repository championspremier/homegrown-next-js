import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import { getActiveProfileIdFromCookies } from "@/lib/active-profile";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage() {
  const { user, activeProfile } = await requireActiveRole("player");
  const supabase = await createClient();
  const effectivePlayerId = (await getActiveProfileIdFromCookies()) ?? user.id;
  const playerId = activeProfile.id;

  const { data: playerProfile } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone_number, birth_date, birth_year, gender, address_1, address_2, postal_code, team_name, competitive_level, positions, role"
    )
    .eq("id", playerId)
    .single();

  const pp = playerProfile as Record<string, unknown> | null;

  let photoUrl: string | null = null;
  const { data: photoData } = supabase.storage
    .from("profile-photos")
    .getPublicUrl(`${playerId}/avatar.jpg`);
  if (photoData?.publicUrl) {
    photoUrl = photoData.publicUrl;
  }

  const { data: homegrownProgram } = await supabase
    .from("programs")
    .select(
      "id, terms_of_service_url, privacy_policy_url, social_facebook, social_instagram, social_tiktok, social_twitter, social_youtube, social_linkedin, contact_email"
    )
    .eq("slug", "homegrown")
    .single();

  const hg = homegrownProgram as Record<string, unknown> | null;

  const { data: onFieldMembership } = await supabase
    .from("program_memberships")
    .select("program_id")
    .eq("profile_id", playerId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const membershipProgramId = (onFieldMembership as Record<string, unknown> | null)?.program_id as string | null;
  let onFieldProgram: Record<string, unknown> | null = null;

  type ActivePlanItem = {
    id: string;
    plan_id: string;
    start_date: string | null;
    plans: {
      name: string | null;
      price: number;
      plan_type: string | null;
      billing_period: string | null;
      cancellation_fee: number | null;
      cancellation_policy_text: string | null;
      solo_access: boolean;
      virtual_access: boolean;
      session_allowances: Record<string, Record<string, number>> | null;
    } | null;
  };
  let activePlans: ActivePlanItem[] = [];
  let pastPlanName: string | null = null;

  const { data: activeSubs } = await (supabase as any)
    .from("plan_subscriptions")
    .select("id, plan_id, start_date, plans(name, price, plan_type, billing_period, cancellation_fee, cancellation_policy_text, solo_access, virtual_access, session_allowances)")
    .eq("player_id", effectivePlayerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(2);
  if (activeSubs?.length) activePlans = activeSubs;

  const { data: pastSub } = await (supabase as any)
    .from("plan_subscriptions")
    .select("plans(name)")
    .eq("player_id", effectivePlayerId)
    .eq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pastSub?.plans?.name) pastPlanName = pastSub.plans.name as string;

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

  return (
    <ProfileClient
      playerId={playerId}
      effectivePlayerId={effectivePlayerId}
      activePlans={activePlans}
      pastPlanName={pastPlanName}
      playerName={`${(pp?.first_name as string) || ""} ${(pp?.last_name as string) || ""}`.trim() || "Player"}
      profile={{
        firstName: (pp?.first_name as string) || "",
        lastName: (pp?.last_name as string) || "",
        email: (pp?.email as string) || "",
        phoneNumber: (pp?.phone_number as string) || "",
        birthDate: (pp?.birth_date as string) || null,
        birthYear: (pp?.birth_year as number) || null,
        gender: (pp?.gender as string) || "",
        address1: (pp?.address_1 as string) || "",
        address2: (pp?.address_2 as string) || "",
        postalCode: (pp?.postal_code as string) || "",
        teamName: (pp?.team_name as string) || "",
        competitiveLevel: (pp?.competitive_level as string) || "",
        positions: (pp?.positions as string[]) || [],
      }}
      photoUrl={photoUrl}
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
