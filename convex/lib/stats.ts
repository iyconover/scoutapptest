import type { Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { listTeams } from "./event"
import type { TeamStats } from "./rpPrediction"

/** Per-team TBA insights + our average rank, for every team at the event. */
export async function loadTeamStats(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Map<number, TeamStats>> {
  const teams = await listTeams(ctx, eventId)
  const insights = await ctx.db
    .query("teamInsights")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
    .collect()
  const aggregates = await ctx.db
    .query("teamAggregates")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
    .collect()
  const insightBy = new Map(insights.map((i) => [i.teamNumber, i]))
  const aggBy = new Map(aggregates.map((a) => [a.teamNumber, a]))

  return new Map(
    teams.map((t) => {
      const i = insightBy.get(t.number)
      const stats: TeamStats = {
        teamNumber: t.number,
        rank: i?.rank ?? null,
        rankingScore: i?.rankingScore ?? null,
        wins: i?.wins ?? 0,
        losses: i?.losses ?? 0,
        ties: i?.ties ?? 0,
        matchesPlayed: i?.matchesPlayed ?? 0,
        opr: i?.opr ?? null,
        avgRank: aggBy.get(t.number)?.avgRank ?? null,
      }
      return [t.number, stats]
    }),
  )
}
