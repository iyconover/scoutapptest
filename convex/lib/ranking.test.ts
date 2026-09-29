import { describe, expect, test } from "vitest"
import { matchAverage, mean, personalAverages, teamAverage } from "./ranking"

describe("mean", () => {
  test("empty input is null", () => {
    expect(mean([])).toBeNull()
  })
  test("single value", () => {
    expect(mean([4])).toBe(4)
  })
  test("arithmetic mean", () => {
    expect(mean([1, 2, 3, 6])).toBe(3)
    expect(mean([1, 2])).toBe(1.5)
  })
})

describe("matchAverage / teamAverage", () => {
  test("delegate to mean", () => {
    expect(matchAverage([1, 3])).toBe(2)
    expect(matchAverage([])).toBeNull()
    expect(teamAverage([2, 3, 4])).toBe(3)
    expect(teamAverage([])).toBeNull()
  })
})

describe("personalAverages", () => {
  const rankings = [
    {
      scouterId: "alice",
      ranks: [
        { teamNumber: 100, rank: 1 },
        { teamNumber: 200, rank: 4 },
      ],
    },
    {
      scouterId: "bob",
      ranks: [
        { teamNumber: 100, rank: 6 },
        { teamNumber: 300, rank: 2 },
      ],
    },
    {
      scouterId: "alice",
      ranks: [
        { teamNumber: 100, rank: 3 },
        { teamNumber: 400, rank: 5 },
      ],
    },
  ]

  test("averages only the given scouter's submissions", () => {
    const result = personalAverages(rankings, "alice")
    expect(result).toEqual(
      new Map([
        [100, 2],
        [200, 4],
        [400, 5],
      ]),
    )
    expect(result.has(300)).toBe(false)
  })

  test("other scouter", () => {
    expect(personalAverages(rankings, "bob")).toEqual(
      new Map([
        [100, 6],
        [300, 2],
      ]),
    )
  })

  test("unknown scouter and empty input give an empty map", () => {
    expect(personalAverages(rankings, "carol").size).toBe(0)
    expect(personalAverages([], "alice").size).toBe(0)
  })
})
