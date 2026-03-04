import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import CommunicateClient from "./communicate-client";

export const dynamic = "force-dynamic";

export default async function AdminCommunicatePage() {
  const { user } = await requireRole("admin");
  const supabase = await createClient();

  const { data: players } = await (supabase as any)
    .from("profiles")
    .select("id, first_name, last_name, positions")
    .eq("role", "player")
    .order("first_name", { ascending: true });

  let messages: unknown[] = [];
  try {
    const { data } = await (supabase as any)
      .from("coach_messages")
      .select("id, message_text, recipient_type, announcement_type, created_at, coach_id")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    messages = data ?? [];
  } catch { /* table may not exist */ }

  // Fetch coach names for messages
  const coachIds = new Set<string>();
  for (const m of messages as Record<string, unknown>[]) {
    if (m.coach_id) coachIds.add(m.coach_id as string);
  }
  const coachMap: Record<string, string> = {};
  if (coachIds.size > 0) {
    const { data: coachProfiles } = await (supabase as any)
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(coachIds));
    for (const c of coachProfiles || []) {
      coachMap[c.id] = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Coach";
    }
  }

  const messagesWithCoach = (messages as Record<string, unknown>[]).map((m) => ({
    id: m.id as string,
    message_text: m.message_text as string,
    recipient_type: m.recipient_type as string,
    announcement_type: (m.announcement_type as string) || "information",
    created_at: m.created_at as string,
    coach_name: coachMap[m.coach_id as string] || "Coach",
  }));

  let recentQuizzes: unknown[] = [];
  try {
    const { data } = await (supabase as any)
      .from("quiz_questions")
      .select("id, question, options, correct_answer, period, category, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);
    recentQuizzes = data ?? [];
  } catch { /* table may not exist */ }

  return (
    <CommunicateClient
      coachId={user.id}
      players={(players || []) as { id: string; first_name: string; last_name: string; positions: string[] | null }[]}
      messages={messagesWithCoach}
      recentQuizzes={recentQuizzes as { id: string; question: string; options: string[]; correct_answer: number; period: string | null; category: string | null; created_at: string }[]}
    />
  );
}
