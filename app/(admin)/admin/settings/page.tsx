import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { profile } = await requireRole("admin");
  const supabase = await createClient();

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("default_program_id")
    .eq("id", profile.id)
    .single();

  const programId = adminProfile?.default_program_id as string | null;

  if (!programId) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto", textAlign: "center", color: "var(--muted)" }}>
        No program linked to your account.
      </div>
    );
  }

  const { data: program } = await supabase
    .from("programs")
    .select(
      `id, name, slug, primary_color, logo_url,
       contact_email, contact_phone, website_url, address,
       social_facebook, social_instagram, social_tiktok,
       social_twitter, social_youtube, social_linkedin,
       lead_capture_url, calendly_org_url,
       cancellation_policy, refund_policy,
       terms_of_service_url, privacy_policy_url,
       plan_tier, plan_started_at, plan_expires_at`
    )
    .eq("id", programId)
    .single();

  if (!program) {
    return (
      <div style={{ maxWidth: 720, margin: "80px auto", textAlign: "center", color: "var(--muted)" }}>
        No program linked to your account.
      </div>
    );
  }

  return <SettingsClient program={program as any} />;
}
