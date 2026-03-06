export type SoloUsage = { technical: number; tactical: number; physical: number; mental: number };

/** Map virtual session type name to allowance key. Same logic as getSessionUsage. */
export function mapSessionTypeNameToKey(name: string): string | null {
  const n = (name || "").trim();
  if (n.includes("CPP") || n.includes("Champions Player Progress")) return "cpp";
  if (n.includes("1:1") || n.includes("1:1 Training")) return "one_on_one";
  if (n.includes("College")) return "college_advising";
  if (n.includes("Psych")) return "psychologist";
  if (n.includes("Nutrition")) return "nutrition";
  if (n.includes("Pro Player") || n.includes("Stories")) return "pro_player_stories";
  if (n.includes("Film")) return "group_film_analysis";
  return null;
}
export type VirtualUsage = {
  cpp: number;
  one_on_one: number;
  college_advising: number;
  psychologist: number;
  nutrition: number;
  pro_player_stories: number;
  group_film_analysis: number;
};

export async function getSessionUsage(
  supabase: any,
  playerId: string,
  billingStartDate: string
): Promise<{ solo: SoloUsage; virtual: VirtualUsage }> {
  const soloUsage: SoloUsage = { technical: 0, tactical: 0, physical: 0, mental: 0 };
  const { data: soloData } = await (supabase as any)
    .from("player_solo_session_bookings")
    .select("solo_sessions(category)")
    .eq("player_id", playerId)
    .in("status", ["scheduled", "checked-in"])
    .gte("created_at", billingStartDate);

  soloData?.forEach((row: { solo_sessions?: { category?: string } }) => {
    const cat = row.solo_sessions?.category;
    if (cat && soloUsage.hasOwnProperty(cat)) (soloUsage as Record<string, number>)[cat]++;
  });

  const virtualUsage: VirtualUsage = {
    cpp: 0,
    one_on_one: 0,
    college_advising: 0,
    psychologist: 0,
    nutrition: 0,
    pro_player_stories: 0,
    group_film_analysis: 0,
  };

  const { data: virtualData } = await (supabase as any)
    .from("individual_session_bookings")
    .select("individual_session_types(name)")
    .eq("player_id", playerId)
    .neq("status", "cancelled")
    .gte("created_at", billingStartDate);

  virtualData?.forEach((row: { individual_session_types?: { name?: string } }) => {
    const name = row.individual_session_types?.name ?? "";
    if (name.includes("CPP") || name.includes("Champions Player Progress")) virtualUsage.cpp++;
    else if (name.includes("1:1") || name.includes("1:1 Training")) virtualUsage.one_on_one++;
    else if (name.includes("College")) virtualUsage.college_advising++;
    else if (name.includes("Psych")) virtualUsage.psychologist++;
    else if (name.includes("Nutrition")) virtualUsage.nutrition++;
    else if (name.includes("Pro Player") || name.includes("Stories")) virtualUsage.pro_player_stories++;
    else if (name.includes("Film")) virtualUsage.group_film_analysis++;
  });

  return { solo: soloUsage, virtual: virtualUsage };
}
