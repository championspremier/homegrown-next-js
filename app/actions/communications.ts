"use server";

import { createClient } from "@/lib/supabase/server";

export async function logCommunication(params: {
  playerId: string;
  contactId: string;
  authorId: string;
  type: "call" | "meeting" | "email" | "note";
  note: string;
  createdAt: string;
}) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("communications")
    .insert({
      player_id: params.playerId,
      contact_id: params.contactId,
      author_id: params.authorId,
      type: params.type,
      note: params.note,
      created_at: params.createdAt,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logSystemCommunication(params: {
  playerId: string;
  authorId: string;
  type: "plan_change" | "offer" | "rating" | "notification";
  note: string;
}) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("communications")
    .insert({
      player_id: params.playerId,
      contact_id: null,
      author_id: params.authorId,
      type: params.type,
      note: params.note,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
