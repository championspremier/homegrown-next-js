"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";
import type { BrandingProps } from "./AppShell";

interface TopbarProps {
  onMenuToggle: () => void;
  rightSlot?: ReactNode;
  mobileDrawer?: boolean;
  branding?: BrandingProps;
}

function useTopbarVisibility() {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const isCoach = pathname.startsWith("/coach");
  const isParent = pathname.startsWith("/parent");
  const isPlayer = pathname.startsWith("/player");

  let showTopbar = false;

  if (isAdmin) {
    const isCommunicate = pathname.includes("/communicate");
    const isProfile = pathname.includes("/profile");
    showTopbar = isCommunicate || isProfile;
  } else if (isCoach) {
    showTopbar = pathname.includes("/profile") || pathname.includes("/communicate");
  } else if (isParent) {
    const isHome = pathname === "/parent" || pathname === "/parent/home";
    const isProfile = pathname.includes("/profile");
    showTopbar = isHome || isProfile;
  } else if (isPlayer) {
    const isHome = pathname === "/player" || pathname === "/player/home";
    const isProfile = pathname.includes("/profile");
    showTopbar = isHome || isProfile;
  }

  const showSignOut = pathname.includes("/profile");
  const hideOnDesktop = isAdmin || isCoach;

  return { showTopbar, showSignOut, hideOnDesktop };
}

export function Topbar({ onMenuToggle, rightSlot, mobileDrawer, branding }: TopbarProps) {
  const { showTopbar, showSignOut, hideOnDesktop } = useTopbarVisibility();

  function handleSignOut() {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/signout";
    document.body.appendChild(form);
    form.submit();
  }

  if (!showTopbar && !mobileDrawer) return null;

  const hasCustomLogo = branding?.white_label_enabled && branding.logo_url && branding.logo_url !== "/logo-light.png";
  const displayName = branding?.program_name || "Homegrown";

  return (
    <header className={`${styles.topbar} ${hideOnDesktop ? styles.topbarHideDesktop : ""}`}>
      <div className={styles.topbarLeft}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
      {mobileDrawer && (
        hasCustomLogo ? (
          <img src={branding!.logo_url!} alt={displayName} className={styles.topbarLogo} />
        ) : (
          <span className={styles.topbarCenter}>{displayName}</span>
        )
      )}
      <div className={styles.topbarRight}>
        {rightSlot}
        {showSignOut && (
          <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
