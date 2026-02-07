import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserWithProfile } from "@/lib/auth";
import { getRoleHome } from "@/lib/role";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: COOKIE_MAX_AGE,
};

/** Validate internal redirect path: must start with "/" and not "//". */
function safeRedirectTo(raw: string | null): string | null {
  const to = (raw ?? "").trim();
  if (to.startsWith("/") && !to.startsWith("//")) return to;
  return null;
}

/**
 * GET /api/active-profile/reset — sets hg_active_profile to auth user id and redirects.
 * Only used immediately after login/signup. Query `to` = desired path (validated); if missing, computes role home.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, user.id, { ...COOKIE_OPTIONS });

  const toParam = safeRedirectTo(request.nextUrl.searchParams.get("to"));
  if (toParam) {
    return NextResponse.redirect(new URL(toParam, request.url), { status: 302 });
  }

  const result = await getAuthUserWithProfile();
  const role = (result?.profile?.role ?? "parent").toLowerCase().trim();
  const fallbackTo = getRoleHome(role);
  return NextResponse.redirect(new URL(fallbackTo, request.url), { status: 302 });
}
