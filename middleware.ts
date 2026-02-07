import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const HG_ACTIVE_PROFILE_COOKIE = "hg_active_profile";

export async function middleware(request: NextRequest) {
  if (process.env.DEBUG_ACTIVE_PROFILE === "true") {
    const pathname = request.nextUrl.pathname;
    const activeProfileId = request.cookies.get(HG_ACTIVE_PROFILE_COOKIE)?.value ?? "(none)";
    console.log("[DEBUG_ACTIVE_PROFILE]", pathname, activeProfileId);
  }
  return await updateSession(request);
}

export const config = {
  // Run middleware except for static assets, favicon, and login/signup. /welcome is included so session refresh runs before role redirect.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|signup|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
