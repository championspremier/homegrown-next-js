import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/debug/auth - Dev-only: check if the server sees a user for this request.
 * Call in the same tab after login (same cookies as /welcome). Returns { hasUser, userId? }.
 * If /welcome redirects to /login, open /api/debug/auth in that tab to see if the server sees the user.
 * Do not use in production or expose tokens.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return NextResponse.json({
      hasUser: !!user,
      userId: user?.id ?? undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { hasUser: false, error: String(e instanceof Error ? e.message : e) },
      { status: 200 }
    );
  }
}
