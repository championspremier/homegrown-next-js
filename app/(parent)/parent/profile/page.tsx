import { requireActiveRole } from "@/lib/auth";
import { getLinkedAccounts } from "@/app/actions/account";
import { UpdateEmailForm } from "@/components/update-email-form";
import { ThemeToggleSection } from "@/components/ThemeToggleSection";
import { LinkPlayerForm } from "./link-player-form";
import styles from "@/components/layout/layout.module.css";

export default async function ParentProfilePage() {
  const { user, profile } = await requireActiveRole("parent");
  const linkedResult = await getLinkedAccounts();
  const linked = linkedResult.linked ?? [];
  const currentEmail = profile?.email ?? user?.email ?? null;

  return (
    <div>
      <h1 className={styles.pageTitle}>Profile</h1>
      <p className={styles.muted}>
        Manage your profile and linked player accounts.
      </p>

      <ThemeToggleSection />

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Login email</h2>
        <p className={styles.mutedNoMargin}>
          Change the email you use to sign in. For development/testing.
        </p>
        <UpdateEmailForm currentEmail={currentEmail} />
      </section>

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Link a player</h2>
        <p className={styles.mutedNoMargin}>
          Enter the player&apos;s email to link their account. They must have signed up with that email.
        </p>
        <LinkPlayerForm />
      </section>

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Linked players</h2>
        {linked.length === 0 ? (
          <p className={styles.mutedNoMargin}>No linked players yet. Link one above.</p>
        ) : (
          <ul className={styles.widgetList}>
            {linked.map((p) => (
              <li key={p.id} className={styles.widgetItem}>
                {p.full_name ?? p.email ?? p.id} ({p.role})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
