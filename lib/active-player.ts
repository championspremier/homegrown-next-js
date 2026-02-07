export const ACTIVE_PLAYER_COOKIE = "active_player_id";

export async function getActivePlayerIdServer(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_PLAYER_COOKIE)?.value ?? null;
}

export function getActivePlayerIdClient(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + ACTIVE_PLAYER_COOKIE + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}
