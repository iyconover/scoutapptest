import { describe, expect, test } from "vitest"
import { DEFAULT_TIE_RP, DEFAULT_WIN_RP } from "./constants"
import { predictStandings, suggestRP, type PredictedMatch, type TeamStats } from "./rpPrediction"

const config = { winRP: DEFAULT_WIN_RP, tieRP: DEFAULT_TIE_RP } // 3 / 1

const stat = (teamNumber: number, overrides: Partial<TeamStats> = {}): TeamStats => ({
  teamNumber,
  rank: null,
  rankingScore: null,
  wins: 0,
  losses: 0,
  ties: 0,
  matchesPlayed: 0,
  opr: null,
  avgRank: null,
  ...overrides,
})

const statMap = (...stats: TeamStats[]): Map<number, TeamStats> =>
  new Map(stats.map((s) => [s.teamNumber, s]))

describe("suggestRP", () => {
  test("OPR decides the winner when every team has one; bonus from ranking score", () => {
    const stats = statMap(
      // (2.5·4 − 3·2 − 1·1) / 4 = 0.75
      stat(1, { opr: 10, rankingScore: 2.5, matchesPlayed: 4, wins: 2, ties: 1 }),
      // (3·4 − 3·2) / 4 = 1.5
      stat(2, { opr: 20, rankingScore: 3, matchesPlayed: 4, wins: 2 }),
      // (0.5·4) / 4 = 0.5
      stat(3, { opr: 30, rankingScore: 0.5, matchesPlayed: 4 }),
      stat(4, { opr: 15 }),
      stat(5, { opr: 15 }),
      stat(6, { opr: 15 }),
    )
    // red OPR 60 > blue 45; red bonus = round((0.75 + 1.5 + 0.5) / 3) = round(0.9167) = 1
    expect(suggestRP({ red: [1, 2, 3], blue: [4, 5, 6] }, stats, config)).toEqual({
      redRP: 4,
      blueRP: 0,
    })
    // swapped sides
    expect(suggestRP({ red: [4, 5, 6], blue: [1, 2, 3] }, stats, config)).toEqual({
      redRP: 0,
      blueRP: 4,
    })
  })

  test("OPR is ignored (even though avgRank disagrees) only when a team lacks OPR", () => {
    const stats = statMap(
      stat(1, { opr: 50, avgRank: 2 }),
      stat(2, { opr: 50, avgRank: 2 }),
      stat(3, { opr: 50, avgRank: 2 }),
      stat(4, { opr: 1, avgRank: 1 }),
      stat(5, { opr: 1, avgRank: 1 }),
      stat(6, { opr: null, avgRank: null }), // counts as 3.5
    )
    // avgRank: red 6, blue 5.5 -> blue wins despite much lower OPR
    expect(suggestRP({ red: [1, 2, 3], blue: [4, 5, 6] }, stats, config)).toEqual({
      redRP: 0,
      blueRP: 3,
    })
  })

  test("teams missing from stats fall back to avgRank 3.5", () => {
    const stats = statMap(stat(1, { opr: 10, avgRank: 3 }), stat(2, { opr: 10, avgRank: 4 }))
    // red: 3 + 3.5 = 6.5, blue: 4 + 3.5 = 7.5 -> red wins
    expect(suggestRP({ red: [1, 99], blue: [2, 98] }, stats, config)).toEqual({
      redRP: 3,
      blueRP: 0,
    })
  })

  test("exact OPR tie -> tie RP for both", () => {
    const stats = statMap(stat(1, { opr: 30 }), stat(2, { opr: 10 }), stat(3, { opr: 40 }))
    expect(suggestRP({ red: [1, 2], blue: [3] }, stats, config)).toEqual({ redRP: 1, blueRP: 1 })
  })

  test("exact avgRank tie (no data at all) -> tie", () => {
    expect(suggestRP({ red: [1, 2, 3], blue: [4, 5, 6] }, new Map(), config)).toEqual({
      redRP: 1,
      blueRP: 1,
    })
  })

  test("bonus is clamped at 0 per team and rounded per alliance", () => {
    const stats = statMap(
      // (1·4 − 3·2) / 4 = −0.5 -> 0
      stat(1, { opr: 10, rankingScore: 1, matchesPlayed: 4, wins: 2 }),
      // (1.5·2) / 2 = 1.5
      stat(2, { opr: 10, rankingScore: 1.5, matchesPlayed: 2 }),
      // no rankingScore -> 0
      stat(3, { opr: 10, rankingScore: null, matchesPlayed: 5, wins: 5 }),
      // 0 played -> 0
      stat(4, { opr: 10, rankingScore: 2, matchesPlayed: 0 }),
      // (3·2) / 2 = 3
      stat(5, { opr: 10, rankingScore: 3, matchesPlayed: 2 }),
      stat(6, { opr: 10 }),
    )
    // red mean = (0 + 1.5 + 0)/3 = 0.5 -> round -> 1 ; blue mean = (0 + 3 + 0)/3 = 1 -> 1
    expect(suggestRP({ red: [1, 2, 3], blue: [4, 5, 6] }, stats, config)).toEqual({
      redRP: 2,
      blueRP: 2,
    })
    // a lone negative team never subtracts RP
    expect(suggestRP({ red: [1], blue: [6] }, stats, config)).toEqual({ redRP: 1, blueRP: 1 })
  })

  test("custom RP config", () => {
    const stats = statMap(
      // (5·2 − 4·2) / 2 = 1
      stat(1, { opr: 20, rankingScore: 5, matchesPlayed: 2, wins: 2 }),
      stat(2, { opr: 10 }),
    )
    expect(suggestRP({ red: [1], blue: [2] }, stats, { winRP: 4, tieRP: 2 })).toEqual({
      redRP: 5,
      blueRP: 0,
    })
  })
})

describe("predictStandings", () => {
  test("empty inputs", () => {
    expect(predictStandings([], [])).toEqual([])
  })

  test("combines played and predicted RP", () => {
    const stats = [
      stat(1, { rank: 2, rankingScore: 2, matchesPlayed: 4 }),
      stat(2, { rank: 1, rankingScore: 2.5, matchesPlayed: 4 }),
      stat(3, { rank: null, rankingScore: null, matchesPlayed: 0 }),
      stat(4, { rank: 3, rankingScore: 1, matchesPlayed: 4 }),
    ]
    const predictions: PredictedMatch[] = [
      { red: [1, 3, 77], blue: [2, 4, 88], redRP: 4, blueRP: 0 },
    ]
    // 1: (8+4)/5 = 2.4 ; 2: 10/5 = 2 ; 3: 4/1 = 4 ; 4: 4/5 = 0.8
    const result = predictStandings(stats, predictions)
    expect(result).toEqual([
      { teamNumber: 3, currentRank: null, predictedRank: 1, predictedRS: 4 },
      { teamNumber: 1, currentRank: 2, predictedRank: 2, predictedRS: 2.4 },
      { teamNumber: 2, currentRank: 1, predictedRank: 3, predictedRS: 2 },
      { teamNumber: 4, currentRank: 3, predictedRank: 4, predictedRS: 0.8 },
    ])
  })

  test("teams with no matches at all get RS 0", () => {
    const result = predictStandings([stat(5), stat(6, { rankingScore: 1, matchesPlayed: 1 })], [])
    expect(result).toEqual([
      { teamNumber: 6, currentRank: null, predictedRank: 1, predictedRS: 1 },
      { teamNumber: 5, currentRank: null, predictedRank: 2, predictedRS: 0 },
    ])
  })

  test("multiple predicted matches accumulate", () => {
    const predictions: PredictedMatch[] = [
      { red: [1], blue: [2], redRP: 3, blueRP: 0 },
      { red: [2], blue: [1], redRP: 1, blueRP: 1 },
    ]
    const result = predictStandings(
      [stat(1, { rankingScore: 2, matchesPlayed: 2 }), stat(2, { rankingScore: 2, matchesPlayed: 2 })],
      predictions,
    )
    // 1: (4 + 4)/4 = 2 ; 2: (4 + 1)/4 = 1.25
    expect(result.map((r) => [r.teamNumber, r.predictedRS])).toEqual([
      [1, 2],
      [2, 1.25],
    ])
  })

  test("ties broken by current rank asc (null last), then team number", () => {
    const stats = [
      stat(40, { rank: null, rankingScore: 2, matchesPlayed: 1 }),
      stat(30, { rank: 5, rankingScore: 2, matchesPlayed: 1 }),
      stat(20, { rank: 3, rankingScore: 2, matchesPlayed: 1 }),
      stat(10, { rank: null, rankingScore: 2, matchesPlayed: 1 }),
      stat(50, { rank: 1, rankingScore: 1, matchesPlayed: 1 }),
    ]
    expect(predictStandings(stats, []).map((r) => [r.teamNumber, r.predictedRank])).toEqual([
      [20, 1],
      [30, 2],
      [10, 3],
      [40, 4],
      [50, 5],
    ])
  })

  test("does not mutate inputs", () => {
    const stats = [stat(2, { rankingScore: 1, matchesPlayed: 1 }), stat(1, { rankingScore: 2, matchesPlayed: 1 })]
    predictStandings(stats, [])
    expect(stats.map((s) => s.teamNumber)).toEqual([2, 1])
  })
})
