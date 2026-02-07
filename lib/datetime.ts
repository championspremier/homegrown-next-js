/**
 * Timezone-safe helpers for datetime-local inputs and timestamptz (UTC ISO).
 * - datetime-local values are treated as the user's LOCAL time.
 * - Store and pass UTC ISO to the server/DB.
 * - Display UTC ISO in the viewer's local time.
 */

/**
 * Convert a datetime-local input value (user's local time) to UTC ISO string.
 * Use before sending to server/Postgres (timestamptz).
 */
export function localDateTimeToUtcIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/**
 * Convert a UTC ISO string (e.g. from DB) to "YYYY-MM-DDTHH:mm" in the viewer's local time
 * for use as <input type="datetime-local"> value. Pads month, day, hour, minute to 2 digits.
 */
export function utcIsoToLocalDateTimeInput(utcIso: string): string {
  const d = new Date(utcIso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}
