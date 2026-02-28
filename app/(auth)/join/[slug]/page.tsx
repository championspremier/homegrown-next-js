import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JoinClient from "./join-client";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = ((profile as Record<string, unknown>)?.role as string || "parent").toLowerCase();
    const homes: Record<string, string> = { admin: "/admin", coach: "/coach", player: "/player", parent: "/parent" };
    redirect(homes[role] || "/parent");
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!program) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 20,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Program not found</h1>
        <p style={{ color: "#6b7280" }}>
          The program &quot;{slug}&quot; doesn&apos;t exist or is no longer active.
        </p>
        <a href="/login" style={{ marginTop: 20, color: "#3b82f6" }}>
          Go to login →
        </a>
      </div>
    );
  }

  const pg = program as Record<string, unknown>;

  const { data: homegrownProgram } = await supabase
    .from("programs")
    .select("id")
    .eq("slug", "homegrown")
    .single();

  return (
    <JoinClient
      program={{
        id: pg.id as string,
        name: (pg.name as string) || "",
        slug: (pg.slug as string) || "",
        logoUrl: (pg.logo_url as string) || null,
        primaryColor: (pg.primary_color as string) || null,
      }}
      homegrownProgramId={(homegrownProgram as Record<string, unknown> | null)?.id as string || null}
    />
  );
}
