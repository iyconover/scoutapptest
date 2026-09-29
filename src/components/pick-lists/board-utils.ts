import type { FunctionReturnType } from "convex/server"

import type { api } from "../../../convex/_generated/api"
import { COLUMNS, type Column } from "../../../convex/lib/validators"

export type PickListOverview = NonNullable<FunctionReturnType<typeof api.pickLists.overview>>
export type ListSummary = PickListOverview["mine"][number]
export type PickListData = NonNullable<FunctionReturnType<typeof api.pickLists.get>>
export type PickListEntry = PickListData["entries"][number]
export type MergeRow = FunctionReturnType<typeof api.pickLists.previewMerge>[number]

/** Team numbers per column, in board order. */
export type BoardColumns = Record<Column, number[]>

export const LIST_NAME_MAX = 60

/** Same ordering the server uses for `get`: column display order, then fractional order. */
export function compareEntries(a: PickListEntry, b: PickListEntry): number {
  return COLUMNS.indexOf(a.column) - COLUMNS.indexOf(b.column) || a.order - b.order
}

export function groupEntries(entries: readonly PickListEntry[]): BoardColumns {
  const columns = Object.fromEntries(COLUMNS.map((c) => [c, [] as PickListEntry[]])) as Record<
    Column,
    PickListEntry[]
  >
  for (const entry of entries) columns[entry.column].push(entry)
  const out = {} as BoardColumns
  for (const c of COLUMNS) out[c] = columns[c].sort((a, b) => a.order - b.order).map((e) => e.teamNumber)
  return out
}

export function isColumn(id: unknown): id is Column {
  return typeof id === "string" && (COLUMNS as readonly string[]).includes(id)
}

/** "Alex's list" for personal lists, "Team-wide" for the primary. */
export function listOwnerLabel(list: ListSummary): string {
  if (list.kind === "primary") return "Team-wide list"
  return list.ownerName ? `${list.ownerName}'s list` : "Personal list"
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}
