"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./layout.module.css";
import type { NavItem } from "@/lib/nav";

export interface BrandingProps {
  logo_url?: string;
  primary_color?: string | null;
  program_name?: string | null;
  white_label_enabled?: boolean;
}

interface AppShellProps {
  navItems: NavItem[];
  roleHome: string;
  profilePhotoUrl?: string | null;
  topbarRight?: React.ReactNode;
  mobileDrawer?: boolean;
  branding?: BrandingProps;
  children: React.ReactNode;
}

export function AppShell({ navItems, roleHome, profilePhotoUrl, topbarRight, mobileDrawer, branding, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const customStyle = branding?.primary_color
    ? { "--program-accent": branding.primary_color } as React.CSSProperties
    : undefined;

  return (
    <div className={`${styles.shell} ${mobileDrawer ? styles.shellDrawerMode : ""}`} style={customStyle}>
      <Sidebar
        navItems={navItems}
        roleHome={roleHome}
        profilePhotoUrl={profilePhotoUrl}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mobileDrawer={mobileDrawer}
        branding={branding}
      />
      <div className={styles.shellContent}>
        <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} rightSlot={topbarRight} mobileDrawer={mobileDrawer} branding={branding} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
