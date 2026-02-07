"use server";

import { cookies } from "next/headers";
import { ACTIVE_PLAYER_COOKIE } from "@/lib/active-player";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setActivePlayerId(playerId: string | null) {
  const cookieStore = await cookies();
  if (playerId) {
    cookieStore.set(ACTIVE_PLAYER_COOKIE, playerId, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(ACTIVE_PLAYER_COOKIE);
  }
}
