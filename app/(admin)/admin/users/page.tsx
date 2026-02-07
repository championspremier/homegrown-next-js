import { createClient } from "@/lib/supabase/server";
import { UsersTable, type ProfileRow } from "./users-table";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("email", { nullsFirst: false });

  const rows: ProfileRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? null,
    full_name: p.full_name ?? null,
    role: p.role ?? "parent",
  }));

  return (
    <div>
      <h1 className={styles.pageTitle}>Users</h1>
      <p className={styles.muted}>
        Manage users and roles. Only admins can view and update roles.
      </p>
      <UsersTable profiles={rows} />
    </div>
  );
}
