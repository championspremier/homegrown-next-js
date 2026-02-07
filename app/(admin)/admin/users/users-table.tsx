"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole } from "@/app/actions/admin";
import { isValidRole } from "@/lib/role";
import type { AppRole } from "@/lib/role";
import styles from "@/components/layout/layout.module.css";

export type ProfileRow = { id: string; email: string | null; full_name: string | null; role: string };

const ROLES: AppRole[] = ["parent", "player", "coach", "admin"];

interface UsersTableProps {
  profiles: ProfileRow[];
}

export function UsersTable({ profiles }: UsersTableProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRoleChange(userId: string, newRole: string) {
    if (!isValidRole(newRole)) return;
    startTransition(async () => {
      const { error } = await updateUserRole(userId, newRole);
      if (error) console.error("Update role failed:", error);
      router.refresh();
    });
  }

  return (
    <div className={styles.shellContent}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "0.5rem 0.75rem" }}>Email</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
            <th style={{ padding: "0.5rem 0.75rem" }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.5rem 0.75rem" }}>{p.email ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>{p.full_name ?? "—"}</td>
              <td style={{ padding: "0.5rem 0.75rem" }}>
                <select
                  value={p.role ?? "parent"}
                  onChange={(e) => handleRoleChange(p.id, e.target.value)}
                  disabled={isPending}
                  className={styles.formInput}
                  style={{ maxWidth: "10rem" }}
                  aria-label={`Change role for ${p.email ?? p.id}`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {profiles.length === 0 && (
        <p className={styles.muted} style={{ marginTop: "1rem" }}>
          No users found.
        </p>
      )}
    </div>
  );
}
