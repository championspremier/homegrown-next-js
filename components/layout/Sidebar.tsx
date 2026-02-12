"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  CreditCard,
  FileText,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  ChartNoAxesCombined,
  SquarePlay,
} from "lucide-react";
import styles from "./layout.module.css";
import type { NavItem } from "@/lib/nav";

const SIDEBAR_STORAGE_KEY = "hg-sidebar-state";

function getIconForHref(href: string) {
  if (href === "/admin" || href === "/coach" || href === "/parent" || href === "/player") return LayoutDashboard;
  if (href.includes("/schedule")) return Calendar;
  if (href.includes("/availability")) return Clock;
  if (href.includes("/users") || href.includes("/people")) return Users;
  if (href.includes("/communicate")) return MessageSquare;
  if (href.includes("/payments")) return CreditCard;
  if (href.includes("/plans")) return FileText;
  if (href.includes("/tracking")) return ChartNoAxesCombined;
  if (href.includes("/solo-create") || href.includes("/solo")) return SquarePlay;
  if (href.includes("/settings")) return Settings;
  if (href.includes("/profile")) return User;
  return FileText;
}

interface SidebarProps {
  navItems: NavItem[];
  roleHome: string;
  open: boolean;
  onClose: () => void;
}

function isActive(pathname: string, href: string): boolean {
  if (href === pathname) return true;
  if (href === "/parent" || href === "/player" || href === "/coach" || href === "/admin") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}

export function Sidebar({ navItems, roleHome, open, onClose }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setIsCollapsed(stored === "closed");
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, isCollapsed ? "closed" : "open");
  }, [isCollapsed]);

  function toggleSidebar() {
    setIsCollapsed((prev) => !prev);
  }

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
        className={`${styles.sidebar} ${styles.sidebarWrapper} ${isCollapsed ? styles.sidebarCollapsed : ""} ${open ? styles.sidebarMobileOpen : ""}`}
        aria-label="Main navigation"
      >
        <div className={styles.sidebarHeader}>
          <Link href={roleHome} className={styles.sidebarLogo} onClick={onClose} aria-label="Homegrown">
            <img src="/logo-light.png" alt="" className={styles.logoLight} width={40} height={40} />
            <img src="/logo-dark.png" alt="" className={styles.logoDark} width={40} height={40} />
          </Link>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const Icon = getIconForHref(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.sidebarLink} ${isActive(pathname, item.href) ? styles.sidebarLinkActive : ""}`}
                data-tooltip={item.label}
                onClick={onClose}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span className={styles.sidebarLabel}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
