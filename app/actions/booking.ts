"use server";

import { createClient } from "@/lib/supabase/server";

export type BookResult = { success: true; bookingId: string } | { success: false; error: string };

export async function bookIndividualSession(
  coachId: string,
  playerId: string,
  parentId: string,
  sessionTypeId: string,
  bookingDate: string,
  bookingTime: string
): Promise<BookResult> {
  const supabase = await createClient();
  // @ts-expect-error - RPC args type not inferred from Database schema
  const { data, error } = await supabase.rpc("book_individual_session", {
    p_coach_id: coachId,
    p_player_id: playerId,
    p_parent_id: parentId,
    p_session_type_id: sessionTypeId,
    p_booking_date: bookingDate,
    p_booking_time: bookingTime,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { booking_id: string | null; error_message: string | null } | null;
  if (!result?.booking_id || result.error_message)
    return { success: false, error: result?.error_message ?? "Booking failed" };
  return { success: true, bookingId: result.booking_id };
}
