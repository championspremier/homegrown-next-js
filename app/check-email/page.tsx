import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return (
    <main className={styles.authPage}>
      <h1 className={styles.authTitle}>Check your email</h1>
      <p className={styles.authMuted}>
        Confirm your email, then sign in.
      </p>
      <p className={styles.authMuted}>
        <Link href="/login" className={styles.linkBlock}>
          Go to sign in →
        </Link>
      </p>
    </main>
  );
}
