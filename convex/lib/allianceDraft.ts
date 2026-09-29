import { ALLIANCE_COUNT, ALLIANCE_SIZE } from "./constants"
import type { Alliance } from "./validators"

export type DraftInput = {
  /** Every eligible team, best predicted event rank first (captain order). */
  seedOrder: readonly number[]
  /** Every eligible team, most desirable pick first. */
  pickOrder: readonly number[]
  /** Current 8 alliances; locked slots are kept, and their teams leave the pool. */
  alliances: readonly Alliance[]
}

const CAPTAIN = 0
const PICK_1 = 1
const PICK_2 = 2

type Slot = number | null

/**
 * FRC alliance selection, 8 alliances × 3 slots (captain, pick 1, pick 2).
 * - Unlocked slots are cleared first; locked teams are removed from the pool.
 * - Captains: each unlocked captain slot, in seed order, takes the best
 *   remaining team in `seedOrder`.
 * - Round 1 (alliance 1→8): each unlocked slot 1 takes the first team in
 *   `pickOrder` that is unplaced OR is the unlocked captain of a LOWER seed.
 *   If a captain is picked, the unlocked captains of the seeds below it shift
 *   up one alliance, and the last unlocked captain slot is filled with the next
 *   team from `seedOrder`.
 * - Round 2 (alliance 8→1, serpentine): each unlocked slot 2 takes the first
 *   unplaced team in `pickOrder` (captains can no longer be picked).
 * - Every invitation is accepted. Returns new alliances (inputs are not mutated),
 *   leaving slots null when the pool runs out.
 */
export function draftAlliances(input: DraftInput): Alliance[] {
  const { seedOrder, pickOrder } = input

  // Normalized working copies: unlocked slots cleared, locked slots kept.
  const locked: boolean[][] = []
  const slots: Slot[][] = []
  for (let a = 0; a < ALLIANCE_COUNT; a++) {
    const source = input.alliances[a]
    const lockRow: boolean[] = []
    const slotRow: Slot[] = []
    for (let s = 0; s < ALLIANCE_SIZE; s++) {
      const isLocked = source?.locked[s] === true
      lockRow.push(isLocked)
      slotRow.push(isLocked ? (source?.slots[s] ?? null) : null)
    }
    locked.push(lockRow)
    slots.push(slotRow)
  }

  const placed = new Set<number>()
  for (const row of slots) for (const team of row) if (team !== null) placed.add(team)

  const nextUnplacedSeed = (): Slot => {
    for (const team of seedOrder) if (!placed.has(team)) return team
    return null
  }
  const place = (alliance: number, slot: number, team: Slot): void => {
    slots[alliance][slot] = team
    if (team !== null) placed.add(team)
  }

  // Captains, in seed order.
  for (let a = 0; a < ALLIANCE_COUNT; a++) {
    if (!locked[a][CAPTAIN]) place(a, CAPTAIN, nextUnplacedSeed())
  }

  /** Alliance index whose unlocked captain slot holds `team`, or -1. */
  const unlockedCaptainIndex = (team: number): number => {
    for (let a = 0; a < ALLIANCE_COUNT; a++) {
      if (!locked[a][CAPTAIN] && slots[a][CAPTAIN] === team) return a
    }
    return -1
  }

  /** Remove the captain of alliance `from`; lower unlocked captains move up one slot. */
  const shiftCaptainsUp = (from: number): void => {
    const unlockedSlots: number[] = []
    for (let a = from; a < ALLIANCE_COUNT; a++) if (!locked[a][CAPTAIN]) unlockedSlots.push(a)
    for (let i = 0; i < unlockedSlots.length - 1; i++) {
      slots[unlockedSlots[i]][CAPTAIN] = slots[unlockedSlots[i + 1]][CAPTAIN]
    }
    const last: number | undefined = unlockedSlots[unlockedSlots.length - 1]
    if (last !== undefined) {
      slots[last][CAPTAIN] = null
      place(last, CAPTAIN, nextUnplacedSeed())
    }
  }

  // Round 1: alliance 1 → 8; lower-seeded captains may be picked.
  for (let a = 0; a < ALLIANCE_COUNT; a++) {
    if (locked[a][PICK_1]) continue
    let pick: Slot = null
    let pickedCaptainOf = -1
    for (const team of pickOrder) {
      if (!placed.has(team)) {
        pick = team
        break
      }
      const captainOf = unlockedCaptainIndex(team)
      if (captainOf > a) {
        pick = team
        pickedCaptainOf = captainOf
        break
      }
    }
    if (pick === null) continue
    // The picked captain is already in `placed`; shifting refills from the unplaced pool.
    if (pickedCaptainOf !== -1) shiftCaptainsUp(pickedCaptainOf)
    place(a, PICK_1, pick)
  }

  // Round 2: alliance 8 → 1 (serpentine); only unplaced teams.
  for (let a = ALLIANCE_COUNT - 1; a >= 0; a--) {
    if (locked[a][PICK_2]) continue
    const pick = pickOrder.find((team) => !placed.has(team)) ?? null
    place(a, PICK_2, pick)
  }

  return slots.map((row, a) => ({ slots: [...row], locked: [...locked[a]] }))
}
