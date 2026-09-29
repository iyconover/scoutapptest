import { PRESENCE_ACTIVE_MS } from "../../convex/lib/constants"
import type { Page } from "../../convex/lib/validators"

/** "Actively scouting" = seen recently on a match scouting page. */
export function isActiveScouter(
  row: { lastSeen: number | null; page: Page | null },
  now: number,
): boolean {
  return row.lastSeen !== null && now - row.lastSeen < PRESENCE_ACTIVE_MS && row.page === "match-scouting"
}

/** Seen anywhere in the app recently. */
export function isOnline(row: { lastSeen: number | null }, now: number): boolean {
  return row.lastSeen !== null && now - row.lastSeen < PRESENCE_ACTIVE_MS
}

/** Presence page for a router pathname. */
export function pageForPath(pathname: string): Page {
  const first = pathname.split("/")[1] ?? ""
  switch (first) {
    case "teams":
    case "pit":
    case "match-scouting":
    case "matches":
    case "pick-lists":
    case "war-games":
    case "admin":
      return first
    default:
      return "home"
  }
}
