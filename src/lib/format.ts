/** "2.33" for an average rank, "—" when there is none. */
export function formatRank(avg: number | null | undefined): string {
  return avg === null || avg === undefined ? "—" : avg.toFixed(2)
}

/** "42.1" for an OPR, "—" when there is none. */
export function formatOpr(opr: number | null | undefined): string {
  return opr === null || opr === undefined ? "—" : opr.toFixed(1)
}

/** "#4" for an event rank, "—" when unranked. */
export function formatEventRank(rank: number | null | undefined): string {
  return rank === null || rank === undefined ? "—" : `#${rank}`
}

/** "City, ST, Country" with missing parts skipped. */
export function formatLocation(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(", ")
}

export function formatTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ""
  return new Date(ms).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
}
