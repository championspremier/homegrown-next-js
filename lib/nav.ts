import type { AppRole } from "./role";

export interface NavItem {
  href: string;
  label: string;
}

/** Parent nav: EXACTLY 4 items */
const PARENT_NAV: NavItem[] = [
  { href: "/parent", label: "Home" },
  { href: "/parent/schedule", label: "Schedule" },
  { href: "/parent/tracking", label: "Tracking" },
  { href: "/parent/profile", label: "Profile" },
];

/** Player nav: EXACTLY 5 items */
const PLAYER_NAV: NavItem[] = [
  { href: "/player", label: "Home" },
  { href: "/player/schedule", label: "Schedule" },
  { href: "/player/solo", label: "Solo" },
  { href: "/player/tracking", label: "Tracking" },
  { href: "/player/profile", label: "Profile" },
];

/** Coach nav: Home, Schedule, People, Communicate, Payments, Plans, Solo Create, Settings, Profile */
const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "Home" },
  { href: "/coach/schedule", label: "Schedule" },
  { href: "/coach/people", label: "People" },
  { href: "/coach/communicate", label: "Communicate" },
  { href: "/coach/payments", label: "Payments" },
  { href: "/coach/plans", label: "Plans" },
  { href: "/coach/solo-create", label: "Solo Create" },
  { href: "/coach/settings", label: "Settings" },
  { href: "/coach/profile", label: "Profile" },
];

/** Admin nav: Coach superset with Users + Availability. */
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Home" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/communicate", label: "Communicate" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/solo-create", label: "Solo Create" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/profile", label: "Profile" },
];

export function getNavItemsForRole(role: string): NavItem[] {
  const r = role?.toLowerCase() as AppRole;
  if (r === "parent") return PARENT_NAV;
  if (r === "player") return PLAYER_NAV;
  if (r === "coach") return COACH_NAV;
  if (r === "admin") return ADMIN_NAV;
  return PARENT_NAV;
}
