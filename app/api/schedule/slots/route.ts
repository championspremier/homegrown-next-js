import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coachId = searchParams.get("coachId");
  const sessionTypeId = searchParams.get("sessionTypeId");
  if (!coachId || !sessionTypeId) {
    return NextResponse.json({ slots: [] }, { status: 200 });
  }
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("coach_availability")
    .select("id, slot_date, slot_time")
    .eq("coach_id", coachId)
    .eq("is_available", true)
    .gte("slot_date", today)
    .order("slot_date", { ascending: true })
    .order("slot_time", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ slots: [] }, { status: 200 });
  return NextResponse.json({ slots: data ?? [] });
}
