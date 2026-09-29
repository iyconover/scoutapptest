import type { Column } from "./validators"

/** 1–2 → tier1, (2,4] → tier2, (4,6] → tier3, null/undefined → uncategorized. */
export function tierForAverage(avg: number | null | undefined): Column {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return "uncategorized"
  if (avg <= 2) return "tier1"
  if (avg <= 4) return "tier2"
  return "tier3"
}
