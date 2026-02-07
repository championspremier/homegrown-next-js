import { createClient } from "@/lib/supabase/server";
import { getRoleHome } from "@/lib/role";
import { NextResponse } from "next/server";

/** GET /api/auth/me - returns user and role-home redirect when session exists (so login can skip /welcome) */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (sessionError || !user) {
    const { data: { user: u }, error } = await supabase.auth.getUser();
    if (error || !u) return NextResponse.json({ user: null, redirect: null });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", u.id)
      .single();
    const role = (profile as { role?: string } | null)?.role ?? "parent";
    return NextResponse.json({
      user: { id: u.id, email: u.email ?? undefined },
      redirect: getRoleHome(role),
    });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role ?? "parent";
  return NextResponse.json({
    user: { id: user.id, email: user.email ?? undefined },
    redirect: getRoleHome(role),
  });
}
