export type AppRole = "parent" | "player" | "coach" | "admin";

const ROLE_HOMES: Record<AppRole, string> = {
  parent: "/parent",
  player: "/player",
  coach: "/coach",
  admin: "/admin",
};

/** Safe role home; never returns undefined. Defaults to /parent if role missing or invalid. */
export function getRoleHome(role: string | undefined | null): string {
  if (role == null || typeof role !== "string" || role.trim() === "") return ROLE_HOMES.parent;
  const normalized = role.toLowerCase().trim() as AppRole;
  return ROLE_HOMES[normalized] ?? ROLE_HOMES.parent;
}

export function isValidRole(role: string): role is AppRole {
  return role === "parent" || role === "player" || role === "coach" || role === "admin";
}

export { getNavItemsForRole } from "./nav";
