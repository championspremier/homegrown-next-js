"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUserWithProfile } from "@/lib/auth";
import { isValidRole } from "@/lib/role";

function normalizeTime(t: string): string {
  if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}

export type UpdateRoleResult = { error: string | null };

export type CreateSessionResult = { error: string | null };

export type CreateAvailabilityResult = { error: string | null };
export type DeleteAvailabilityResult = { error: string | null };

/**
 * Create a session. Only admins can call this. RLS allows admins to insert into sessions.
 */
export async function createSession(params: {
  coach_id: string;
  type: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
}): Promise<CreateSessionResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can create sessions" };

  const { coach_id, type, starts_at, ends_at, capacity } = params;
  if (!coach_id?.trim()) return { error: "Coach is required" };
  if (!type?.trim()) return { error: "Type is required" };
  if (!starts_at) return { error: "Start time is required" };
  if (!ends_at) return { error: "End time is required" };
  if (typeof capacity !== "number" || capacity < 1) return { error: "Capacity must be at least 1" };

  const startDate = new Date(starts_at);
  const endDate = new Date(ends_at);
  if (Number.isNaN(startDate.getTime())) return { error: "Invalid start time" };
  if (Number.isNaN(endDate.getTime())) return { error: "Invalid end time" };
  if (endDate.getTime() <= startDate.getTime()) return { error: "End time must be after start time" };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    coach_id: coach_id.trim(),
    type: type.trim(),
    starts_at,
    ends_at,
    capacity,
  });

  return { error: error?.message ?? null };
}

/**
 * Create a coach availability block. Only admins. RLS allows admins to insert into coach_availability.
 * Rejects duplicate (same coach_id, day_of_week, start_time, end_time).
 */
export async function createAvailability(params: {
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<CreateAvailabilityResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can manage availability" };

  const { coach_id, day_of_week, start_time, end_time } = params;
  if (!coach_id?.trim()) return { error: "Coach is required" };
  if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) return { error: "Invalid day" };
  if (!start_time?.trim()) return { error: "Start time is required" };
  if (!end_time?.trim()) return { error: "End time is required" };

  const start = normalizeTime(start_time.trim());
  const end = normalizeTime(end_time.trim());
  if (start >= end) return { error: "Start time must be before end time" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("coach_availability")
    .select("id")
    .eq("coach_id", coach_id.trim())
    .eq("day_of_week", day_of_week)
    .eq("start_time", start)
    .eq("end_time", end)
    .limit(1);
  if (existing?.length) return { error: "This availability block already exists for this coach." };

  const { error } = await supabase.from("coach_availability").insert({
    coach_id: coach_id.trim(),
    day_of_week,
    start_time: start,
    end_time: end,
  });

  return { error: error?.message ?? null };
}

/**
 * Delete a coach availability block. Only admins. RLS allows admins to delete.
 */
export async function deleteAvailability(params: { id: string }): Promise<DeleteAvailabilityResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can manage availability" };

  const { id } = params;
  if (!id?.trim()) return { error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_availability").delete().eq("id", id.trim());

  return { error: error?.message ?? null };
}

/**
 * Update a user's role. Only admins can call this.
 * RLS allows admins to update any profile; this action enforces admin check and validates role.
 */
export async function updateUserRole(userId: string, newRole: string): Promise<UpdateRoleResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can change roles" };

  const role = newRole?.trim().toLowerCase();
  if (!role || !isValidRole(role)) return { error: "Invalid role" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  return { error: error?.message ?? null };
}
