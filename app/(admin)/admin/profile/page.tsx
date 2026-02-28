import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import AdminProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const { profile } = await requireRole("admin");
  const supabase = await createClient();
  const adminId = profile.id;

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone_number, gender, address_1, address_2, postal_code, coach_role, team_logos"
    )
    .eq("id", adminId)
    .single();

  const ap = adminProfile as Record<string, unknown> | null;

  const { data: photoData } = supabase.storage
    .from("profile-photos")
    .getPublicUrl(`${adminId}/avatar.jpg`);

  return (
    <AdminProfileClient
      adminId={adminId}
      profile={{
        firstName: (ap?.first_name as string) || "",
        lastName: (ap?.last_name as string) || "",
        email: (ap?.email as string) || "",
        phone: (ap?.phone_number as string) || "",
        gender: (ap?.gender as string) || "not-specified",
        address1: (ap?.address_1 as string) || "",
        address2: (ap?.address_2 as string) || "",
        postalCode: (ap?.postal_code as string) || "",
        coachRole: (ap?.coach_role as string) || "Coach",
        teamLogos: (ap?.team_logos as string[]) || [],
      }}
      photoUrl={photoData?.publicUrl || null}
    />
  );
}
