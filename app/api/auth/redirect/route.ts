/**
 * Legacy. Do not use. Post-auth redirect is GET /welcome (single role-routing decision point).
 * Kept for backwards compatibility only. Login/signup use window.location.assign("/welcome").
 */
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getRoleHome } from "@/lib/role";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/types/database";

export async function GET() {
  return NextResponse.json({ error: "Use GET /welcome after login" }, { status: 405 });
}

/**
 * POST /api/auth/redirect - legacy. Prefer GET /welcome after sign-in.
 */
export async function POST(request: NextRequest) {
  const { url: supabaseUrl, anonKey } = getSupabaseEnv();
  const defaultHome = getRoleHome("parent");
  const redirectUrl = new URL(defaultHome, request.url);
  const response = NextResponse.redirect(redirectUrl, 303);

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<NextResponse["cookies"]["set"]>[2])
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "parent";
  const finalPath = getRoleHome(role);
  const finalUrl = new URL(finalPath, request.url);

  if (finalUrl.pathname !== redirectUrl.pathname) {
    const roleResponse = NextResponse.redirect(finalUrl, 303);
    response.headers.getSetCookie?.().forEach((cookie) => {
      roleResponse.headers.append("Set-Cookie", cookie);
    });
    return roleResponse;
  }
  return response;
}
