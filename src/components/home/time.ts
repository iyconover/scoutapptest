/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatRelative(ms: number | null | undefined, now: number): string {
  if (ms === null || ms === undefined) return "Never"
  const diff = Math.max(0, now - ms)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

/** Parse a TBA "YYYY-MM-DD" date as a local calendar date. */
function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** "Mar 6 – 8, 2026" (or the raw strings if they can't be parsed). */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (!start || !end) return `${startDate} – ${endDate}`
  const monthDay: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const startText = start.toLocaleDateString(undefined, monthDay)
  if (start.getTime() === end.getTime()) {
    return start.toLocaleDateString(undefined, { ...monthDay, year: "numeric" })
  }
  const endText = end.toLocaleDateString(undefined, {
    ...monthDay,
    year: "numeric",
  })
  return `${startText} – ${endText}`
}
