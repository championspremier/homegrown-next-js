"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";
import type { NavItem } from "@/lib/nav";

interface SidebarProps {
  navItems: NavItem[];
  roleHome: string;
  open: boolean;
  onClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  if (href !== "/parent" && href !== "/player" && href !== "/coach" && href !== "/admin") {
    return pathname.startsWith(href);
  }
  return pathname === href;
}

export function Sidebar({ navItems, roleHome, open, onClose }: SidebarProps) {
  const pathname = usePathname() ?? "";

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          onClick={onClose}
          aria-label="Close menu"
        />
      )}
      <aside
        className={`${styles.sidebarWrapper} ${styles.sidebarMobile} ${open ? styles.sidebarMobileOpen : ""}`}
      >
        <nav className={`${styles.sidebar} ${styles.sidebarNav}`} aria-label="Main">
          <Link
            href={roleHome}
            className={`${styles.sidebarLink} ${styles.sidebarLinkLogo} ${isActive(pathname, roleHome) ? styles.sidebarLinkActive : ""}`}
            onClick={onClose}
          >
            Homegrown
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.sidebarLink} ${isActive(pathname, item.href) ? styles.sidebarLinkActive : ""}`}
              onClick={onClose}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
