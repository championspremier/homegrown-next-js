import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import styles from "./schedule.module.css";

export default async function ScheduleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className={styles.schedulePage}>
      <nav className={styles.scheduleNav}>
        <Link href="/dashboard">← Dashboard</Link>
      </nav>
      {children}
    </div>
  );
}
