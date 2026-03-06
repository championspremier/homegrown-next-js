import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProgramBranding {
  logo_url: string;
  primary_color: string | null;
  email_sender_name: string;
  onboarding_message: string | null;
  white_label_enabled: boolean;
  program_name: string | null;
}

const DEFAULTS: ProgramBranding = {
  logo_url: "/logo-light.png",
  primary_color: null,
  email_sender_name: "Homegrown",
  onboarding_message: null,
  white_label_enabled: false,
  program_name: null,
};

export async function getProgramBranding(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProgramBranding> {
  try {
    const { data: membership } = await (supabase as any)
      .from("program_memberships")
      .select("program_id, programs(id, name, logo_url, primary_color, email_sender_name, onboarding_message, white_label_enabled)")
      .eq("profile_id", profileId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!membership?.programs) return DEFAULTS;

    const program = membership.programs as {
      id: string;
      name: string;
      logo_url: string | null;
      primary_color: string | null;
      email_sender_name: string | null;
      onboarding_message: string | null;
      white_label_enabled: boolean | null;
    };

    if (!program.white_label_enabled) return DEFAULTS;

    return {
      logo_url: program.logo_url || DEFAULTS.logo_url,
      primary_color: program.primary_color || null,
      email_sender_name: program.email_sender_name || DEFAULTS.email_sender_name,
      onboarding_message: program.onboarding_message || null,
      white_label_enabled: true,
      program_name: program.name,
    };
  } catch {
    return DEFAULTS;
  }
}
