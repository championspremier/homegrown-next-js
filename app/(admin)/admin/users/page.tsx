import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { UsersClient } from "./users-client";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: profiles } = await (supabase as any)
    .from("profiles")
    .select(
      "id, email, full_name, first_name, last_name, role, birth_date, gender, phone_number, address_1, address_2, postal_code, created_at, updated_at"
    )
    .order("full_name", { nullsFirst: false });

  const { data: memberships } = await (supabase as any)
    .from("program_memberships")
    .select("id, profile_id, program_id, program_role, is_active, programs(id, name, logo_url)")
    .order("created_at");

  const { data: programs } = await (supabase as any)
    .from("programs")
    .select("id, name, logo_url")
    .eq("is_active", true)
    .order("name");

  const { data: relationships } = await (supabase as any)
    .from("parent_player_relationships")
    .select("parent_id, player_id");

  return (
    <div>
      <h1 className={styles.pageTitle}>Users</h1>
      <UsersClient
        profiles={profiles ?? []}
        memberships={memberships ?? []}
        programs={programs ?? []}
        relationships={relationships ?? []}
      />
    </div>
  );
}
