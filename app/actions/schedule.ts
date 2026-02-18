"use server";

import { createClient } from "@/lib/supabase/server";

export type ReserveResult =
  | { success: true; reservationId: string }
  | { success: false; error: string };

export type BookIndividualResult =
  | { success: true; booking: Record<string, unknown> }
  | { success: false; error: string };

export type CancelResult = { success: true } | { success: false; error: string };

export async function reserveGroupSession(
  sessionId: string,
  playerId: string
): Promise<ReserveResult> {
  const supabase = await createClient();
  // @ts-expect-error - RPC args type not inferred from Database schema
  const { data, error } = await supabase.rpc("create_reservation_for_player", {
    p_session_id: sessionId,
    p_player_id: playerId,
    p_reservation_status: "reserved",
  });
  if (error) {
    const code = (error as { code?: string }).code;
    const msg = error.message ?? "";
    const isDuplicate =
      code === "P0001" ||
      code === "23505" ||
      /already has a reservation/i.test(msg);
    return {
      success: false,
      error: isDuplicate ? "You already have a reservation for this session." : msg,
    };
  }
  const reservationId = data as string | null;
  if (!reservationId) return { success: false, error: "Reservation failed" };
  return { success: true, reservationId };
}

export async function bookIndividualSessionForPlayer(
  sessionTypeId: string,
  coachId: string,
  playerId: string,
  parentId: string | null,
  bookingDate: string,
  bookingTime: string,
  durationMinutes: number
): Promise<BookIndividualResult> {
  const supabase = await createClient();
  // @ts-expect-error - RPC args type not inferred from Database schema
  const { data, error } = await supabase.rpc("create_individual_booking_for_player", {
    p_session_type_id: sessionTypeId,
    p_coach_id: coachId,
    p_player_id: playerId,
    p_parent_id: parentId,
    p_booking_date: bookingDate,
    p_booking_time: bookingTime,
    p_duration_minutes: durationMinutes,
  });
  if (error) return { success: false, error: error.message };
  const rows = data as Record<string, unknown>[] | null;
  const booking = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!booking) return { success: false, error: "Booking failed" };
  return { success: true, booking };
}

export async function cancelReservation(
  reservationId: string,
  isIndividual: boolean
): Promise<CancelResult> {
  const supabase = await createClient();
  // @ts-expect-error - RPC args type not inferred from Database schema
  const { error } = await supabase.rpc("cancel_reservation_for_player", {
    p_reservation_id: reservationId,
    p_is_individual: isIndividual,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
