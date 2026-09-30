import type { Alliance } from "../../../convex/lib/validators"

/** Where a dragged team comes from / is dropped. */
export type BoardLocation = { kind: "slot"; alliance: number; slot: number } | { kind: "pool" }

export function cloneAlliances(alliances: readonly Alliance[]): Alliance[] {
  return alliances.map((a) => ({ slots: [...a.slots], locked: [...a.locked] }))
}

export function placedTeams(alliances: readonly Alliance[]): Set<number> {
  const placed = new Set<number>()
  for (const a of alliances) for (const t of a.slots) if (t !== null) placed.add(t)
  return placed
}

/**
 * New board after dropping `team` (from `source`) on `target`, or null when the
 * drop changes nothing / is not allowed. Slot → slot swaps; pool → slot replaces
 * (the displaced team returns to the pool); slot → pool clears the slot.
 * Locked slots can't be dragged from or dropped onto.
 */
export function applyDrop(
  alliances: readonly Alliance[],
  team: number,
  source: BoardLocation,
  target: BoardLocation,
): Alliance[] | null {
  const next = cloneAlliances(alliances)
  const isLocked = (loc: BoardLocation) => loc.kind === "slot" && next[loc.alliance]?.locked[loc.slot] === true

  if (isLocked(source) || isLocked(target)) return null
  if (source.kind === "pool" && target.kind === "pool") return null

  if (target.kind === "pool") {
    if (source.kind !== "slot") return null
    next[source.alliance].slots[source.slot] = null
    return next
  }

  const targetRow = next[target.alliance]
  if (!targetRow || target.slot < 0 || target.slot >= targetRow.slots.length) return null

  if (source.kind === "slot") {
    if (source.alliance === target.alliance && source.slot === target.slot) return null
    const displaced = targetRow.slots[target.slot] ?? null
    targetRow.slots[target.slot] = team
    next[source.alliance].slots[source.slot] = displaced
    return next
  }

  // From the pool: make sure the team isn't somewhere else already (stale data).
  for (const row of next) row.slots = row.slots.map((t) => (t === team ? null : t))
  targetRow.slots[target.slot] = team
  return next
}
