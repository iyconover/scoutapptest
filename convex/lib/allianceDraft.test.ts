import { describe, expect, test } from "vitest"
import { draftAlliances } from "./allianceDraft"
import { ALLIANCE_COUNT } from "./constants"
import type { Alliance } from "./validators"

type Slot = number | null

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

const emptyAlliances = (): Alliance[] =>
  Array.from({ length: ALLIANCE_COUNT }, () => ({
    slots: [null, null, null],
    locked: [false, false, false],
  }))

/** Build 8 alliances; `locks` maps [allianceIndex, slotIndex] -> team. */
const withLocks = (locks: [number, number, Slot][]): Alliance[] => {
  const alliances = emptyAlliances()
  for (const [a, s, team] of locks) {
    alliances[a].slots[s] = team
    alliances[a].locked[s] = true
  }
  return alliances
}

const slotsOf = (alliances: Alliance[]): Slot[][] => alliances.map((a) => a.slots)

const SEEDS = range(1, 24)

describe("draftAlliances", () => {
  test("full draft, no locks, no captains picked: serpentine round 2", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [...range(9, 24), ...range(1, 8)],
      alliances: emptyAlliances(),
    })
    expect(slotsOf(result)).toEqual([
      [1, 9, 24],
      [2, 10, 23],
      [3, 11, 22],
      [4, 12, 21],
      [5, 13, 20],
      [6, 14, 19],
      [7, 15, 18],
      [8, 16, 17],
    ])
    expect(result.every((a) => a.locked.every((l) => !l))).toBe(true)
  })

  test("unlocked slots in the input are cleared and recomputed", () => {
    const alliances = emptyAlliances()
    alliances[0].slots = [24, 23, 22]
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [...range(9, 24), ...range(1, 8)],
      alliances,
    })
    expect(result[0].slots).toEqual([1, 9, 24])
  })

  test("teams cannot pick their own or a higher seed's captain", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [1, ...range(9, 24), ...range(2, 8)],
      alliances: emptyAlliances(),
    })
    expect(result[0].slots.slice(0, 2)).toEqual([1, 9])
    expect(result[1].slots.slice(0, 2)).toEqual([2, 10])
  })

  test("captain shift when a lower seed's captain is picked", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [3, ...range(10, 24), 1, 2, ...range(4, 9)],
      alliances: emptyAlliances(),
    })
    // Alliance 1 picks captain 3; captains 4..8 move up, 9 becomes alliance 8's captain.
    expect(slotsOf(result)).toEqual([
      [1, 3, 24],
      [2, 10, 23],
      [4, 11, 22],
      [5, 12, 21],
      [6, 13, 20],
      [7, 14, 19],
      [8, 15, 18],
      [9, 16, 17],
    ])
  })

  test("chained captain picks refill from seedOrder each time", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [3, 9, ...range(11, 24), 10, 1, 2, ...range(4, 8)],
      alliances: emptyAlliances(),
    })
    // A1 picks 3 -> captains [1,2,4,5,6,7,8,9]; A2 picks 9 (A8's new captain) -> A8 captain 10.
    expect(result.map((a) => a.slots[0])).toEqual([1, 2, 4, 5, 6, 7, 8, 10])
    expect(result.map((a) => a.slots[1])).toEqual([3, 9, 11, 12, 13, 14, 15, 16])
    expect(result.map((a) => a.slots[2])).toEqual([24, 23, 22, 21, 20, 19, 18, 17])
  })

  test("locked captains stay put, cannot be picked, and are skipped by the shift", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [20, 2, ...range(9, 19), ...range(21, 24), 1, ...range(3, 8)],
      alliances: withLocks([[3, 0, 20]]),
    })
    expect(slotsOf(result)).toEqual([
      [1, 2, 24],
      [3, 9, 23],
      [4, 10, 22],
      [20, 11, 21],
      [5, 12, 19],
      [6, 13, 18],
      [7, 14, 17],
      [8, 15, 16],
    ])
    expect(result[3].locked).toEqual([true, false, false])
  })

  test("a locked captain's team leaves the captain pool", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [...range(9, 24), ...range(1, 8)],
      alliances: withLocks([[0, 0, 5]]),
    })
    expect(result.map((a) => a.slots[0])).toEqual([5, 1, 2, 3, 4, 6, 7, 8])
  })

  test("locked pick slots are kept, their teams unavailable, and those alliances skip the round", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [...range(9, 24), ...range(1, 8)],
      alliances: withLocks([
        [1, 1, 9],
        [4, 2, 30],
      ]),
    })
    expect(slotsOf(result)).toEqual([
      [1, 10, 23],
      [2, 9, 22],
      [3, 11, 21],
      [4, 12, 20],
      [5, 13, 30],
      [6, 14, 19],
      [7, 15, 18],
      [8, 16, 17],
    ])
  })

  test("a locked empty slot stays empty", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [...range(9, 24), ...range(1, 8)],
      alliances: withLocks([[7, 1, null]]),
    })
    expect(result[7].slots).toEqual([8, null, 16])
    expect(result[6].slots).toEqual([7, 15, 17])
  })

  test("pool exhaustion leaves trailing slots null", () => {
    const result = draftAlliances({
      seedOrder: range(1, 10),
      pickOrder: [9, 10, ...range(1, 8)],
      alliances: emptyAlliances(),
    })
    // A3 picks captain 4, A4 picks captain 6, A5 picks captain 8; no seeds left to refill.
    expect(slotsOf(result)).toEqual([
      [1, 9, null],
      [2, 10, null],
      [3, 4, null],
      [5, 6, null],
      [7, 8, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ])
  })

  test("fewer teams than captain slots", () => {
    const result = draftAlliances({
      seedOrder: [1, 2, 3],
      pickOrder: [1, 2, 3],
      alliances: emptyAlliances(),
    })
    // A1 picks 2 -> captains [1,3]; A2 picks nothing (3 is its own captain).
    expect(slotsOf(result).slice(0, 3)).toEqual([
      [1, 2, null],
      [3, null, null],
      [null, null, null],
    ])
  })

  test("empty pool", () => {
    const result = draftAlliances({ seedOrder: [], pickOrder: [], alliances: emptyAlliances() })
    expect(slotsOf(result)).toEqual(emptyAlliances().map((a) => a.slots))
  })

  test("every team is placed at most once", () => {
    const result = draftAlliances({
      seedOrder: SEEDS,
      pickOrder: [5, 3, 8, 7, ...range(9, 24), 1, 2, 4, 6],
      alliances: withLocks([
        [2, 0, 12],
        [5, 1, 1],
      ]),
    })
    const placed = result.flatMap((a) => a.slots).filter((t): t is number => t !== null)
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed).toHaveLength(24)
  })

  test("does not mutate the input", () => {
    const alliances = withLocks([[3, 0, 20]])
    alliances[0].slots = [99, 98, 97]
    const snapshot = JSON.parse(JSON.stringify(alliances)) as Alliance[]
    const seedOrder = [...SEEDS]
    const pickOrder = [...SEEDS].reverse()
    const result = draftAlliances({ seedOrder, pickOrder, alliances })
    expect(alliances).toEqual(snapshot)
    expect(seedOrder).toEqual(SEEDS)
    expect(result[0].slots).not.toBe(alliances[0].slots)
    expect(result[0].locked).not.toBe(alliances[0].locked)
  })
})
