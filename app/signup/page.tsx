import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignupForm from "./signup-form";
import styles from "@/components/layout/layout.module.css";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/api/active-profile/reset");
  return (
    <main className={styles.authPage}>
      <h1 className={styles.authTitle}>Sign up</h1>
      <SignupForm />
      <p className={styles.authMuted}>
        <a href="/login">Log in</a> if you already have an account.
      </p>
    </main>
  );
}
