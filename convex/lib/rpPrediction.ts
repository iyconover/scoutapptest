export type TeamStats = {
  teamNumber: number
  /** Current TBA event rank. */
  rank: number | null
  /** TBA ranking score (average RP per match). */
  rankingScore: number | null
  wins: number
  losses: number
  ties: number
  matchesPlayed: number
  opr: number | null
  /** Our scouters' average rank (1 best … 6 worst). */
  avgRank: number | null
}

export type RPConfig = { winRP: number; tieRP: number }

export type AllianceTeams = { red: readonly number[]; blue: readonly number[] }

/** avgRank used for a team we have no scouting average for. */
const MISSING_AVG_RANK = 3.5

function sum(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += value
  return total
}

/** Average non-win/tie RP per match for one team (≥ 0); 0 when unknown. */
function bonusPerMatch(stats: TeamStats | undefined, config: RPConfig): number {
  if (!stats || stats.rankingScore === null || stats.matchesPlayed <= 0) return 0
  const played = stats.matchesPlayed
  const bonus =
    (stats.rankingScore * played - config.winRP * stats.wins - config.tieRP * stats.ties) / played
  return Math.max(0, bonus)
}

function allianceBonus(
  teams: readonly number[],
  stats: ReadonlyMap<number, TeamStats>,
  config: RPConfig,
): number {
  if (teams.length === 0) return 0
  const perTeam = teams.map((team) => bonusPerMatch(stats.get(team), config))
  return Math.round(sum(perTeam) / teams.length)
}

/** Positive → red wins, negative → blue wins, 0 → tie. */
function compareAlliances(match: AllianceTeams, stats: ReadonlyMap<number, TeamStats>): number {
  const allTeams = [...match.red, ...match.blue]
  const everyTeamHasOpr = allTeams.every((team) => {
    const opr = stats.get(team)?.opr
    return opr !== null && opr !== undefined
  })

  if (everyTeamHasOpr) {
    const oprOf = (team: number): number => stats.get(team)?.opr ?? 0
    return sum(match.red.map(oprOf)) - sum(match.blue.map(oprOf))
  }

  const avgRankOf = (team: number): number => stats.get(team)?.avgRank ?? MISSING_AVG_RANK
  // Lower avgRank is better, so blue − red is positive when red is better.
  return sum(match.blue.map(avgRankOf)) - sum(match.red.map(avgRankOf))
}

/**
 * Suggested RP for one unplayed match.
 * Winner: higher summed OPR (missing OPR counts as 0) if every team has an OPR;
 * otherwise lower summed avgRank (missing counts as 3.5); exact tie → tie.
 * Bonus RP per alliance = round(mean over its teams of
 *   max(0, (rankingScore·played − winRP·W − tieRP·T) / played)),
 * teams with 0 played or no rankingScore contribute 0.
 */
export function suggestRP(
  match: AllianceTeams,
  stats: ReadonlyMap<number, TeamStats>,
  config: RPConfig,
): { redRP: number; blueRP: number } {
  const outcome = compareAlliances(match, stats)
  let redRP: number
  let blueRP: number
  if (outcome > 0) {
    redRP = config.winRP
    blueRP = 0
  } else if (outcome < 0) {
    redRP = 0
    blueRP = config.winRP
  } else {
    redRP = config.tieRP
    blueRP = config.tieRP
  }
  return {
    redRP: redRP + allianceBonus(match.red, stats, config),
    blueRP: blueRP + allianceBonus(match.blue, stats, config),
  }
}

export type PredictedMatch = AllianceTeams & { redRP: number; blueRP: number }

export type PredictedStanding = {
  teamNumber: number
  currentRank: number | null
  predictedRank: number
  predictedRS: number
}

/**
 * Predicted RS = (rankingScore·played + predicted RP) / (played + predicted matches),
 * 0 when a team has no matches at all. Sorted by RS desc, ties by current rank asc
 * (null last), then team number. predictedRank is 1-based.
 */
export function predictStandings(
  stats: readonly TeamStats[],
  predictions: readonly PredictedMatch[],
): PredictedStanding[] {
  const predicted = new Map<number, { rp: number; matches: number }>()
  const credit = (team: number, rp: number): void => {
    const entry = predicted.get(team)
    if (entry) {
      entry.rp += rp
      entry.matches += 1
    } else {
      predicted.set(team, { rp, matches: 1 })
    }
  }
  for (const match of predictions) {
    for (const team of new Set(match.red)) credit(team, match.redRP)
    for (const team of new Set(match.blue)) credit(team, match.blueRP)
  }

  const rows = stats.map((team) => {
    const played = Math.max(0, team.matchesPlayed)
    const future = predicted.get(team.teamNumber) ?? { rp: 0, matches: 0 }
    const totalMatches = played + future.matches
    const predictedRS =
      totalMatches === 0 ? 0 : ((team.rankingScore ?? 0) * played + future.rp) / totalMatches
    return { teamNumber: team.teamNumber, currentRank: team.rank, predictedRS }
  })

  rows.sort((a, b) => {
    if (a.predictedRS !== b.predictedRS) return b.predictedRS - a.predictedRS
    if (a.currentRank !== b.currentRank) {
      if (a.currentRank === null) return 1
      if (b.currentRank === null) return -1
      return a.currentRank - b.currentRank
    }
    return a.teamNumber - b.teamNumber
  })

  return rows.map((row, index) => ({ ...row, predictedRank: index + 1 }))
}
