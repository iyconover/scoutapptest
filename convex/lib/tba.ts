/**
 * The Blue Alliance API v3 client + mappers into our import shapes.
 * Used only from actions. Key lives in the Convex env var TBA_API_KEY.
 */
import { v, type Infer } from "convex/values"

import { appError } from "./errors"

const TBA_BASE = "https://www.thebluealliance.com/api/v3"

export const importTeamV = v.object({
  tbaKey: v.string(),
  number: v.number(),
  nickname: v.string(),
  city: v.optional(v.string()),
  stateProv: v.optional(v.string()),
  country: v.optional(v.string()),
})
export type ImportTeam = Infer<typeof importTeamV>

export const importMatchV = v.object({
  tbaKey: v.string(),
  number: v.number(),
  red: v.array(v.number()),
  blue: v.array(v.number()),
  scheduledTime: v.optional(v.number()),
  redScore: v.optional(v.number()),
  blueScore: v.optional(v.number()),
})
export type ImportMatch = Infer<typeof importMatchV>

export const rankingRowV = v.object({
  teamNumber: v.number(),
  rank: v.number(),
  rankingScore: v.optional(v.number()),
  wins: v.number(),
  losses: v.number(),
  ties: v.number(),
  matchesPlayed: v.number(),
})
export type RankingRow = Infer<typeof rankingRowV>

export const oprRowV = v.object({
  teamNumber: v.number(),
  opr: v.number(),
  dpr: v.optional(v.number()),
  ccwm: v.optional(v.number()),
})
export type OprRow = Infer<typeof oprRowV>

type FetchResult<T> = { status: 200; data: T; etag: string | null } | { status: 304 }

export async function tbaFetch<T>(path: string, etag?: string): Promise<FetchResult<T>> {
  const key = process.env.TBA_API_KEY
  if (!key) throw appError("TBA_ERROR", "TBA_API_KEY is not set on the Convex deployment.")
  const headers: Record<string, string> = { "X-TBA-Auth-Key": key }
  if (etag) headers["If-None-Match"] = etag
  const res = await fetch(`${TBA_BASE}${path}`, { headers })
  if (res.status === 304) return { status: 304 }
  if (res.status === 404) throw appError("NOT_FOUND", "The Blue Alliance has no data for that event key.")
  if (res.status === 401) throw appError("TBA_ERROR", "The Blue Alliance rejected the API key.")
  if (!res.ok) throw appError("TBA_ERROR", `The Blue Alliance returned HTTP ${res.status}.`)
  return { status: 200, data: (await res.json()) as T, etag: res.headers.get("ETag") }
}

const teamNumberFromKey = (key: string) => Number(key.replace(/^frc/, ""))

// ---- Raw TBA shapes (only the fields we read) ----

export type TbaEvent = { key: string; name: string; start_date: string; end_date: string }

type TbaTeamSimple = {
  key: string
  team_number: number
  nickname: string | null
  name: string
  city: string | null
  state_prov: string | null
  country: string | null
}

type TbaMatchSimple = {
  key: string
  comp_level: string
  match_number: number
  alliances: {
    red: { team_keys: string[]; score: number | null }
    blue: { team_keys: string[]; score: number | null }
  }
  time: number | null
  predicted_time: number | null
}

type TbaRankings = {
  rankings: {
    team_key: string
    rank: number
    matches_played: number
    record: { wins: number; losses: number; ties: number } | null
    sort_orders: number[] | null
  }[]
} | null

type TbaOprs = {
  oprs: Record<string, number>
  dprs?: Record<string, number>
  ccwms?: Record<string, number>
} | null

// ---- Mappers ----

export function mapTeams(raw: TbaTeamSimple[]): ImportTeam[] {
  return raw.map((t) => ({
    tbaKey: t.key,
    number: t.team_number,
    nickname: t.nickname ?? t.name,
    city: t.city ?? undefined,
    stateProv: t.state_prov ?? undefined,
    country: t.country ?? undefined,
  }))
}

/** Qualification matches only. TBA uses -1 / null for unplayed scores. */
export function mapQualMatches(raw: TbaMatchSimple[]): ImportMatch[] {
  const score = (s: number | null) => (s === null || s < 0 ? undefined : s)
  const time = (m: TbaMatchSimple) => m.time ?? m.predicted_time
  return raw
    .filter((m) => m.comp_level === "qm")
    .map((m) => {
      const t = time(m)
      return {
        tbaKey: m.key,
        number: m.match_number,
        red: m.alliances.red.team_keys.map(teamNumberFromKey),
        blue: m.alliances.blue.team_keys.map(teamNumberFromKey),
        scheduledTime: t === null ? undefined : t * 1000,
        redScore: score(m.alliances.red.score),
        blueScore: score(m.alliances.blue.score),
      }
    })
    .sort((a, b) => a.number - b.number)
}

/** sort_orders[0] is the ranking score (average RP) for current FRC games. */
export function mapRankings(raw: TbaRankings): RankingRow[] {
  if (!raw) return []
  return raw.rankings.map((r) => ({
    teamNumber: teamNumberFromKey(r.team_key),
    rank: r.rank,
    rankingScore: r.sort_orders?.[0] ?? undefined,
    wins: r.record?.wins ?? 0,
    losses: r.record?.losses ?? 0,
    ties: r.record?.ties ?? 0,
    matchesPlayed: r.matches_played,
  }))
}

export function mapOprs(raw: TbaOprs): OprRow[] {
  if (!raw?.oprs) return []
  return Object.entries(raw.oprs).map(([key, opr]) => ({
    teamNumber: teamNumberFromKey(key),
    opr,
    dpr: raw.dprs?.[key],
    ccwm: raw.ccwms?.[key],
  }))
}

// ---- High-level fetches ----

export async function fetchEventImport(tbaKey: string) {
  const event = await tbaFetch<TbaEvent>(`/event/${tbaKey}`)
  const teams = await tbaFetch<TbaTeamSimple[]>(`/event/${tbaKey}/teams/simple`)
  const matches = await tbaFetch<TbaMatchSimple[]>(`/event/${tbaKey}/matches/simple`)
  if (event.status !== 200 || teams.status !== 200 || matches.status !== 200) {
    throw appError("TBA_ERROR", "Unexpected cached response from The Blue Alliance.")
  }
  return {
    event: event.data,
    teams: mapTeams(teams.data),
    matches: mapQualMatches(matches.data),
    matchesEtag: matches.etag,
  }
}

export type InsightFetch = {
  rankings?: RankingRow[]
  oprs?: OprRow[]
  matches?: ImportMatch[]
  etags: Record<string, string>
  changed: boolean
}

/** Fetch rankings, OPRs and match scores, skipping unchanged endpoints via ETags. */
export async function fetchInsights(
  tbaKey: string,
  etags: Record<string, string>,
): Promise<InsightFetch> {
  const next = { ...etags }
  const out: InsightFetch = { etags: next, changed: false }

  const rankings = await tbaFetch<TbaRankings>(`/event/${tbaKey}/rankings`, etags.rankings)
  if (rankings.status === 200) {
    out.rankings = mapRankings(rankings.data)
    if (rankings.etag) next.rankings = rankings.etag
    out.changed = true
  }
  const oprs = await tbaFetch<TbaOprs>(`/event/${tbaKey}/oprs`, etags.oprs)
  if (oprs.status === 200) {
    out.oprs = mapOprs(oprs.data)
    if (oprs.etag) next.oprs = oprs.etag
    out.changed = true
  }
  const matches = await tbaFetch<TbaMatchSimple[]>(`/event/${tbaKey}/matches/simple`, etags.matches)
  if (matches.status === 200) {
    out.matches = mapQualMatches(matches.data ?? [])
    if (matches.etag) next.matches = matches.etag
    out.changed = true
  }
  return out
}
