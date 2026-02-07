import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DebugSupabasePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let dbCheck: string = "not attempted";
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (error) {
      dbCheck = `error: ${error.message} (RLS or schema may block access)`;
    } else {
      dbCheck = data ? `ok (found profile id)` : "ok (no rows)";
    }
  } catch (e) {
    dbCheck = e instanceof Error ? e.message : "unknown error";
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "40rem" }}>
      <h1>Supabase debug</h1>
      <section style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Session</h2>
        {session?.user?.email ? (
          <p data-session="yes">Logged in: {session.user.email}</p>
        ) : (
          <p data-session="no">No session</p>
        )}
      </section>
      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>DB check (profiles, limit 1)</h2>
        <p>{dbCheck}</p>
      </section>
    </main>
  );
}
