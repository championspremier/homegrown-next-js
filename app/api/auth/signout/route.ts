import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 302 });
}
