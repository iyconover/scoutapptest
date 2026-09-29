import { describe, expect, test } from "vitest"
import { findAssignmentConflicts, type ScheduleMatch } from "./assignments"

const m = (
  number: number,
  red: number[],
  blue: number[],
  closed = false,
): ScheduleMatch => ({ number, red, blue, closed })

describe("findAssignmentConflicts", () => {
  const schedule: ScheduleMatch[] = [
    m(6, [2, 7, 20], [1, 21, 22]), // 1, 2, 7 across alliances -> conflict
    m(1, [1, 2, 3], [4, 5, 6]), // before current match
    m(2, [1, 2, 7], [8, 9, 10]), // 1, 2, 7 -> conflict (== currentMatchNumber)
    m(3, [1, 7, 11], [2, 12, 13], true), // would conflict but closed
    m(4, [1, 14, 15], [7, 16, 17]), // only 2 watched teams
    m(5, [1, 2, 18], [19, 23, 24]), // only 2 watched teams
    m(0, [1, 2, 7], [3, 4, 5]), // before current match
  ]

  test("returns unclosed, current-or-later conflicting matches in ascending order", () => {
    expect(findAssignmentConflicts(schedule, 2, [1, 2], 7)).toEqual([2, 6])
  })

  test("closed matches are ignored", () => {
    expect(findAssignmentConflicts(schedule, 3, [1, 2], 7)).toEqual([6])
  })

  test("matches before currentMatchNumber are ignored", () => {
    expect(findAssignmentConflicts(schedule, 7, [1, 2], 7)).toEqual([])
    expect(findAssignmentConflicts(schedule, 0, [1, 2], 7)).toEqual([0, 2, 6])
  })

  test("newTeam already assigned is not double-counted", () => {
    expect(findAssignmentConflicts(schedule, 0, [1, 2], 2)).toEqual([])
    expect(findAssignmentConflicts(schedule, 0, [1, 2, 7], 7)).toEqual([0, 2, 6])
  })

  test("matches without newTeam are never reported", () => {
    expect(findAssignmentConflicts([m(10, [1, 2, 3], [4, 5, 6])], 1, [1, 2, 3], 99)).toEqual([])
  })

  test("exactly MAX teams is not a conflict", () => {
    expect(findAssignmentConflicts([m(1, [1, 2, 3], [4, 5, 6])], 1, [1], 4)).toEqual([])
  })

  test("duplicate teams within a match count once", () => {
    expect(findAssignmentConflicts([m(1, [1, 1, 2], [2, 5, 6])], 1, [1, 2], 9)).toEqual([])
  })

  test("empty inputs", () => {
    expect(findAssignmentConflicts([], 1, [1, 2], 3)).toEqual([])
    expect(findAssignmentConflicts(schedule, 0, [], 7)).toEqual([])
  })
})
