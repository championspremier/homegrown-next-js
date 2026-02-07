"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./layout.module.css";
import type { NavItem } from "@/lib/nav";

interface AppShellProps {
  navItems: NavItem[];
  roleHome: string;
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ navItems, roleHome, topbarRight, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar
        navItems={navItems}
        roleHome={roleHome}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={styles.shellContent}>
        <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} rightSlot={topbarRight} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
