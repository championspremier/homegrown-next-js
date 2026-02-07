"use client";

import { useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "@/components/layout/layout.module.css";

export default function LandingClient() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/api/active-profile/reset");
    });
  }, [router]);

  return (
    <main className={styles.landingMain}>
      <h1>Homegrown</h1>
      <p className={styles.landingMuted}>Parent, player, coach.</p>
      <nav className={styles.landingNav}>
        <Link href="/login">Log in</Link>
        <Link href="/signup">Sign up</Link>
      </nav>
    </main>
  );
}
