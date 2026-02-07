import { requireActiveRole } from "@/lib/auth";
import { UpdateEmailForm } from "@/components/update-email-form";
import styles from "@/components/layout/layout.module.css";

export default async function PlayerProfilePage() {
  const { user, profile } = await requireActiveRole("player");
  const currentEmail = profile?.email ?? user?.email ?? null;

  return (
    <div>
      <h1 className={styles.pageTitle}>Profile</h1>
      <p className={styles.muted}>
        Manage your profile and login email.
      </p>

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Login email</h2>
        <p className={styles.mutedNoMargin}>
          Change the email you use to sign in. For development/testing.
        </p>
        <UpdateEmailForm currentEmail={currentEmail} />
      </section>
    </div>
  );
}
