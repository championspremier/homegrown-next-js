import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import CoachProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function CoachProfilePage() {
  const { profile } = await requireRole("coach");
  const supabase = await createClient();
  const coachId = profile.id;

  const { data: coachProfile } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone_number, gender, address_1, address_2, postal_code, coach_role, team_logos"
    )
    .eq("id", coachId)
    .single();

  const cp = coachProfile as Record<string, unknown> | null;

  const { data: photoData } = supabase.storage
    .from("profile-photos")
    .getPublicUrl(`${coachId}/avatar.jpg`);

  return (
    <CoachProfileClient
      coachId={coachId}
      profile={{
        firstName: (cp?.first_name as string) || "",
        lastName: (cp?.last_name as string) || "",
        email: (cp?.email as string) || "",
        phone: (cp?.phone_number as string) || "",
        gender: (cp?.gender as string) || "not-specified",
        address1: (cp?.address_1 as string) || "",
        address2: (cp?.address_2 as string) || "",
        postalCode: (cp?.postal_code as string) || "",
        coachRole: (cp?.coach_role as string) || "Coach",
        teamLogos: (cp?.team_logos as string[]) || [],
      }}
      photoUrl={photoData?.publicUrl || null}
    />
  );
}
