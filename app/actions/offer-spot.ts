"use server";

import { createClient } from "@/lib/supabase/server";
import { logSystemCommunication } from "./communications";

const DOCSEND_VIDEO_URL = "https://docsend.com/view/p5taz9wn9zbtn3qf";
const DOCSEND_DOC_URL = "https://docsend.com/view/5kwang35vqyadijn";
const DOCSEND_PASSWORD = "Champion";

export async function sendProgramOffer(params: {
  playerId: string;
  programId: string;
  offeredBy: string;
  personalMessage: string | null;
  expiresAt: string;
  programName: string;
  parentIds: string[];
}) {
  const supabase = await createClient();
  const { playerId, programId, offeredBy, personalMessage, expiresAt, programName, parentIds } = params;

  const { data: offer, error } = await (supabase as any)
    .from("program_offers")
    .insert({
      player_id: playerId,
      program_id: programId,
      plan_id: null,
      offered_by: offeredBy,
      personal_message: personalMessage || null,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  const offerId = offer?.id;
  if (!offerId) return { ok: false, error: "Failed to create offer" };

  const expiryFormatted = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const mainMessage = `Congratulations! You've been offered a spot in ${programName}. Check out what we offer before accepting. Offer expires ${expiryFormatted}.`;
  const fullMessage = personalMessage ? `${mainMessage}\n\n${personalMessage}` : mainMessage;

  const notifPayload = {
    notification_type: "information" as const,
    title: "You've been offered a spot! 🎉",
    message: fullMessage,
    is_read: false,
    data: {
      offer_id: offerId,
      program_id: programId,
      expires_at: expiresAt,
      video_url: DOCSEND_VIDEO_URL,
      docsend_url: DOCSEND_DOC_URL,
      password: DOCSEND_PASSWORD,
    },
  };

  await (supabase as any).from("notifications").insert({
    ...notifPayload,
    recipient_id: playerId,
    recipient_role: "player",
  });

  for (const parentId of parentIds) {
    await (supabase as any).from("notifications").insert({
      ...notifPayload,
      recipient_id: parentId,
      recipient_role: "parent",
    });
  }

  await logSystemCommunication({
    playerId,
    authorId: offeredBy,
    type: "offer",
    note: `Offer sent for ${programName}. Expires ${expiryFormatted}.`,
  });

  return { ok: true, offerId };
}

export async function acceptProgramOffer(offerId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("program_offers")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
