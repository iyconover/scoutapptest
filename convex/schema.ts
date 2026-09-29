import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import {
  allianceV,
  columnV,
  draftMethodV,
  listKindV,
  matchSourceV,
  pageV,
  pitFields,
  rankEntryV,
  roleV,
} from "./lib/validators"

export default defineSchema({
  ...authTables,

  /** App-level identity + role. The auth `users` table is left untouched. */
  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    role: roleV,
  }).index("by_user", ["userId"]),

  /** Singleton row. */
  appSettings: defineTable({
    activeEventId: v.optional(v.id("events")),
  }),

  events: defineTable({
    tbaKey: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    leadScoutId: v.optional(v.id("users")),
    currentMatchNumber: v.number(),
    liveSync: v.boolean(),
    lastSyncAt: v.optional(v.number()),
    /** TBA ETags keyed by endpoint name ("rankings" | "oprs" | "matches"). */
    etags: v.record(v.string(), v.string()),
  }).index("by_tbaKey", ["tbaKey"]),

  teams: defineTable({
    eventId: v.id("events"),
    tbaKey: v.string(),
    number: v.number(),
    nickname: v.string(),
    city: v.optional(v.string()),
    stateProv: v.optional(v.string()),
    country: v.optional(v.string()),
  }).index("by_event_number", ["eventId", "number"]),

  /** Qualification matches only. */
  matches: defineTable({
    eventId: v.id("events"),
    tbaKey: v.optional(v.string()),
    number: v.number(),
    red: v.array(v.number()),
    blue: v.array(v.number()),
    scheduledTime: v.optional(v.number()),
    redScore: v.optional(v.number()),
    blueScore: v.optional(v.number()),
    source: matchSourceV,
    closed: v.boolean(),
    closedBy: v.optional(v.id("users")),
  }).index("by_event_number", ["eventId", "number"]),

  /** TBA rankings + OPRs, refreshed by the sync cron. */
  teamInsights: defineTable({
    eventId: v.id("events"),
    teamNumber: v.number(),
    rank: v.optional(v.number()),
    rankingScore: v.optional(v.number()),
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
    matchesPlayed: v.number(),
    opr: v.optional(v.number()),
    dpr: v.optional(v.number()),
    ccwm: v.optional(v.number()),
  }).index("by_event_team", ["eventId", "teamNumber"]),

  pitReports: defineTable({
    eventId: v.id("events"),
    teamNumber: v.number(),
    ...pitFields,
    updatedBy: v.id("users"),
  }).index("by_event_team", ["eventId", "teamNumber"]),

  /** One 1–6 ranking of all six teams, per scouter per match. */
  matchRankings: defineTable({
    eventId: v.id("events"),
    matchId: v.id("matches"),
    scouterId: v.id("users"),
    ranks: v.array(rankEntryV),
  })
    .index("by_match", ["matchId"])
    .index("by_match_scouter", ["matchId", "scouterId"])
    .index("by_event_scouter", ["eventId", "scouterId"]),

  /** One note per (match, author, team). */
  matchNotes: defineTable({
    eventId: v.id("events"),
    matchId: v.id("matches"),
    matchNumber: v.number(),
    teamNumber: v.number(),
    authorId: v.id("users"),
    text: v.string(),
    assignmentId: v.optional(v.id("assignments")),
  })
    .index("by_match", ["matchId"])
    .index("by_match_author_team", ["matchId", "authorId", "teamNumber"])
    .index("by_event_team", ["eventId", "teamNumber"]),

  /** Derived: mean rank of a team within one match. Written only by lib/aggregates. */
  matchTeamRanks: defineTable({
    eventId: v.id("events"),
    matchId: v.id("matches"),
    matchNumber: v.number(),
    teamNumber: v.number(),
    avgRank: v.number(),
    count: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_event_team", ["eventId", "teamNumber"]),

  /** Derived: per-team rollup. Written only by lib/aggregates. */
  teamAggregates: defineTable({
    eventId: v.id("events"),
    teamNumber: v.number(),
    avgRank: v.optional(v.number()),
    matchesRanked: v.number(),
    reportCount: v.number(),
  }).index("by_event_team", ["eventId", "teamNumber"]),

  /** Admin-assigned "watch this team" duties. Soft-deleted via `active`. */
  assignments: defineTable({
    eventId: v.id("events"),
    scouterId: v.id("users"),
    teamNumber: v.number(),
    instructions: v.string(),
    createdBy: v.id("users"),
    active: v.boolean(),
  })
    .index("by_event_scouter", ["eventId", "scouterId"])
    .index("by_event_team", ["eventId", "teamNumber"]),

  presence: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    page: pageV,
    matchId: v.optional(v.id("matches")),
    lastSeen: v.number(),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"]),

  pickLists: defineTable({
    eventId: v.id("events"),
    kind: listKindV,
    ownerId: v.optional(v.id("users")),
    name: v.string(),
  })
    .index("by_event_kind", ["eventId", "kind"])
    .index("by_event_owner", ["eventId", "ownerId"]),

  pickListEntries: defineTable({
    listId: v.id("pickLists"),
    teamNumber: v.number(),
    column: columnV,
    /** Fractional index within the column (see lib/ordering). */
    order: v.number(),
  })
    .index("by_list_team", ["listId", "teamNumber"])
    .index("by_list_column_order", ["listId", "column", "order"]),

  /** Event-wide "already picked" markers; fades the team on every list. */
  selectedTeams: defineTable({
    eventId: v.id("events"),
    teamNumber: v.number(),
    markedBy: v.id("users"),
  }).index("by_event_team", ["eventId", "teamNumber"]),

  warGames: defineTable({
    eventId: v.id("events"),
    name: v.string(),
    createdBy: v.id("users"),
    method: draftMethodV,
    manualOrder: v.array(v.number()),
    winRP: v.number(),
    tieRP: v.number(),
    alliances: v.array(allianceV),
  }).index("by_event", ["eventId"]),

  /** Manual RP overrides only; unset matches use the live suggestion. */
  warGamePredictions: defineTable({
    warGameId: v.id("warGames"),
    matchId: v.id("matches"),
    redRP: v.number(),
    blueRP: v.number(),
    manual: v.boolean(),
  }).index("by_warGame_match", ["warGameId", "matchId"]),
})
