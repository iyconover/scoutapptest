import { describe, expect, test } from "vitest"
import { mergePickLists, type ListForMerge } from "./consensus"
import type { Column } from "./validators"

type Entry = { teamNumber: number; column: Column; order: number }
const e = (teamNumber: number, column: Column, order: number): Entry => ({
  teamNumber,
  column,
  order,
})
const list = (...entries: Entry[]): ListForMerge => ({ entries })

describe("mergePickLists", () => {
  test("empty inputs", () => {
    expect(mergePickLists([], [])).toEqual([])
    expect(mergePickLists([], [30, 10, 20])).toEqual([
      { teamNumber: 10, column: "uncategorized", score: null, votes: 0 },
      { teamNumber: 20, column: "uncategorized", score: null, votes: 0 },
      { teamNumber: 30, column: "uncategorized", score: null, votes: 0 },
    ])
  })

  test("position within tier uses `order`, not array order", () => {
    const lists = [
      list(e(1, "tier1", 0), e(2, "tier1", 1), e(3, "tier2", 0)),
      // array order is 1, 2 but order values put 2 first
      list(e(1, "tier1", 10), e(2, "tier1", 5), e(3, "tier3", 0)),
    ]
    // team 1: 1.0 and 1.5 -> 1.25; team 2: 1.5 and 1.0 -> 1.25; team 3: 2.0 and 3.0 -> 2.5
    expect(mergePickLists(lists, [1, 2, 3])).toEqual([
      { teamNumber: 1, column: "tier1", score: 1.25, votes: 2 },
      { teamNumber: 2, column: "tier1", score: 1.25, votes: 2 },
      { teamNumber: 3, column: "tier2", score: 2.5, votes: 2 },
    ])
  })

  test("tier size of 3 gives fractional positions 0, 1/3, 2/3", () => {
    const result = mergePickLists(
      [list(e(7, "tier2", 3), e(8, "tier2", 1), e(9, "tier2", 2))],
      [7, 8, 9],
    )
    expect(result.map((r) => r.teamNumber)).toEqual([8, 9, 7])
    expect(result[0].score).toBe(2)
    expect(result[1].score).toBeCloseTo(2 + 1 / 3)
    expect(result[2].score).toBeCloseTo(2 + 2 / 3)
    expect(result.every((r) => r.column === "tier2")).toBe(true)
  })

  test("column is the floor of the score", () => {
    const lists = [
      // team 1: 1.5 (second of two in tier1); team 2: 1.0
      list(e(2, "tier1", 0), e(1, "tier1", 1), e(3, "tier3", 0), e(4, "tier3", 1)),
      // team 1: 2.5 (second of two in tier2); team 3: 3.0; team 4: 3.5
      list(e(5, "tier2", 0), e(1, "tier2", 1), e(3, "tier3", 0), e(4, "tier3", 1)),
    ]
    const byTeam = new Map(mergePickLists(lists, [1, 2, 3, 4, 5]).map((r) => [r.teamNumber, r]))
    expect(byTeam.get(1)).toEqual({ teamNumber: 1, column: "tier2", score: 2, votes: 2 })
    expect(byTeam.get(2)).toEqual({ teamNumber: 2, column: "tier1", score: 1, votes: 1 })
    expect(byTeam.get(3)).toEqual({ teamNumber: 3, column: "tier3", score: 3, votes: 2 })
    expect(byTeam.get(4)).toEqual({ teamNumber: 4, column: "tier3", score: 3.5, votes: 2 })
    expect(byTeam.get(5)).toEqual({ teamNumber: 5, column: "tier2", score: 2, votes: 1 })
  })

  test("worst possible score (3.x) stays in tier3", () => {
    const lists = [list(e(1, "tier3", 0), e(2, "tier3", 1), e(3, "tier3", 2), e(4, "tier3", 3))]
    const result = mergePickLists(lists, [4])
    expect(result).toEqual([{ teamNumber: 4, column: "tier3", score: 3.75, votes: 1 }])
  })

  test("exactly 50% DNP -> dnp", () => {
    const lists = [list(e(1, "dnp", 0)), list(e(1, "tier1", 0))]
    expect(mergePickLists(lists, [1])).toEqual([
      { teamNumber: 1, column: "dnp", score: null, votes: 2 },
    ])
  })

  test("DNP minority is ignored for the score but counted as a vote", () => {
    const lists = [list(e(1, "dnp", 0)), list(e(1, "tier1", 0)), list(e(1, "tier2", 0))]
    expect(mergePickLists(lists, [1])).toEqual([
      { teamNumber: 1, column: "tier1", score: 1.5, votes: 3 },
    ])
  })

  test("uncategorized placements are not votes", () => {
    const lists = [
      list(e(1, "uncategorized", 0), e(2, "uncategorized", 0)),
      list(e(1, "dnp", 0), e(2, "uncategorized", 0)),
      list(e(1, "uncategorized", 0), e(3, "tier1", 0)),
    ]
    expect(mergePickLists(lists, [1, 2, 3])).toEqual([
      { teamNumber: 3, column: "tier1", score: 1, votes: 1 },
      { teamNumber: 1, column: "dnp", score: null, votes: 1 },
      { teamNumber: 2, column: "uncategorized", score: null, votes: 0 },
    ])
  })

  test("output is ordered by column, then score, dnp/uncategorized by team number", () => {
    const lists = [
      list(
        e(50, "tier3", 0),
        e(40, "tier1", 1),
        e(30, "tier1", 0),
        e(20, "tier2", 0),
        e(99, "dnp", 0),
        e(11, "dnp", 1),
      ),
    ]
    const result = mergePickLists(lists, [99, 60, 50, 40, 30, 20, 11, 5])
    expect(result.map((r) => [r.teamNumber, r.column])).toEqual([
      [30, "tier1"],
      [40, "tier1"],
      [20, "tier2"],
      [50, "tier3"],
      [11, "dnp"],
      [99, "dnp"],
      [5, "uncategorized"],
      [60, "uncategorized"],
    ])
  })

  test("teams outside allTeams are not emitted, duplicates emitted once", () => {
    const lists = [list(e(1, "tier1", 0), e(999, "tier1", 1))]
    const result = mergePickLists(lists, [1, 1])
    expect(result).toEqual([{ teamNumber: 1, column: "tier1", score: 1, votes: 1 }])
  })

  test("does not mutate inputs", () => {
    const entries = [e(2, "tier1", 5), e(1, "tier1", 1)]
    const lists = [{ entries }]
    const teams = [2, 1]
    mergePickLists(lists, teams)
    expect(entries.map((x) => x.teamNumber)).toEqual([2, 1])
    expect(teams).toEqual([2, 1])
  })
})
