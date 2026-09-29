/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

const newTest = () => convexTest(schema, modules)
type T = ReturnType<typeof newTest>

async function newUser(t: T, email: string, profile = true) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  if (profile) await as.mutation(api.users.ensureProfile, {})
  return { userId, as }
}

const code = (c: string) => ({ data: expect.objectContaining({ code: c }) })

const TEAMS = [1, 2, 3, 4, 5, 6, 7, 8]
const teamRows = (nums: number[]) => nums.map((n) => ({ tbaKey: `frc${n}`, number: n, nickname: `Team ${n}` }))

function importArgs(overrides: Partial<{ matches: { tbaKey: string; number: number; red: number[]; blue: number[] }[]; teams: number[]; tbaKey: string }> = {}) {
  return {
    tbaKey: overrides.tbaKey ?? "2026test",
    name: "Test Event",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    teams: teamRows(overrides.teams ?? TEAMS),
    matches: overrides.matches ?? [
      { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6] },
      { tbaKey: "2026test_qm2", number: 2, red: [7, 8, 1], blue: [2, 3, 4] },
    ],
  }
}

async function counts(t: T, eventId: Id<"events">) {
  return await t.run(async (ctx) => ({
    teams: (await ctx.db.query("teams").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()).length,
    matches: (await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()).length,
    events: (await ctx.db.query("events").collect()).length,
    primaryLists: (
      await ctx.db.query("pickLists").withIndex("by_event_kind", (q) => q.eq("eventId", eventId).eq("kind", "primary")).collect()
    ).length,
    entries: (await ctx.db.query("pickListEntries").collect()).length,
  }))
}

describe("events", () => {
  test("active is null without an event; requires auth", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    expect(await a.as.query(api.events.active, {})).toBeNull()
    await expect(t.query(api.events.active, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })

  test("upsertImport sets the event active; active has the documented shape", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    expect(await a.as.query(api.events.active, {})).toEqual({
      _id: eventId,
      tbaKey: "2026test",
      name: "Test Event",
      startDate: "2026-03-01",
      endDate: "2026-03-03",
      leadScout: null,
      currentMatchNumber: 1,
      liveSync: true,
      lastSyncAt: null,
      hasSchedule: true,
      teamCount: 8,
    })
  })

  test("upsertImport creates the primary list and a personal list per profile, each with every team", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    const lists = await t.run((ctx) => ctx.db.query("pickLists").collect())
    expect(lists.filter((l) => l.kind === "primary")).toHaveLength(1)
    expect(lists.filter((l) => l.kind === "personal").map((l) => l.ownerId).sort()).toEqual([a.userId, b.userId].sort())
    expect((await counts(t, eventId)).entries).toBe(3 * TEAMS.length)
  })

  test("re-import is idempotent: no duplicate events/teams/matches/lists/entries", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    const id1 = await t.mutation(internal.events.upsertImport, importArgs())
    const before = await counts(t, id1)
    const id2 = await t.mutation(internal.events.upsertImport, importArgs())
    expect(id2).toBe(id1)
    expect(await counts(t, id1)).toEqual(before)
    expect(before).toMatchObject({ teams: 8, matches: 2, events: 1, primaryLists: 1 })
  })

  test("re-import with an added team adds uncategorized entries to every list", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    await t.mutation(internal.events.upsertImport, importArgs({ teams: [...TEAMS, 9] }))
    const c = await counts(t, eventId)
    expect(c.teams).toBe(9)
    expect(c.entries).toBe(2 * 9)
  })

  test("a TBA match replaces a manual match with the same number", async () => {
    const t = convexTest(schema, modules)
    const admin = await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs({ matches: [] }))
    expect(await admin.as.query(api.events.active, {})).toMatchObject({ hasSchedule: false })
    const manualId = await admin.as.mutation(api.matchScouting.setManualTeams, {
      number: 1,
      red: [1, 2, 3],
      blue: [4, 5, 6],
    })
    await t.mutation(internal.events.upsertImport, importArgs({
      matches: [{ tbaKey: "2026test_qm1", number: 1, red: [8, 7, 6], blue: [5, 4, 3] }],
    }))
    const matches = await t.run((ctx) =>
      ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect(),
    )
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ _id: manualId, source: "tba", tbaKey: "2026test_qm1", red: [8, 7, 6], blue: [5, 4, 3] })
    expect(await admin.as.query(api.events.active, {})).toMatchObject({ hasSchedule: true })
  })

  test("list is admin-only and returns the documented shape", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    await expect(b.as.query(api.events.list, {})).rejects.toMatchObject(code("FORBIDDEN"))
    expect(await a.as.query(api.events.list, {})).toEqual([
      { _id: eventId, tbaKey: "2026test", name: "Test Event", startDate: "2026-03-01", endDate: "2026-03-03" },
    ])
  })

  test("setLeadScout is admin-only; sets and clears the lead", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    await expect(a.as.mutation(api.events.setLeadScout, { userId: b.userId })).rejects.toMatchObject(
      code("NO_ACTIVE_EVENT"),
    )
    await t.mutation(internal.events.upsertImport, importArgs())
    await expect(b.as.mutation(api.events.setLeadScout, { userId: b.userId })).rejects.toMatchObject(code("FORBIDDEN"))
    await a.as.mutation(api.events.setLeadScout, { userId: b.userId })
    expect(await b.as.query(api.events.active, {})).toMatchObject({
      leadScout: { userId: b.userId, displayName: "bob" },
    })
    await a.as.mutation(api.events.setLeadScout, { userId: null })
    expect(await b.as.query(api.events.active, {})).toMatchObject({ leadScout: null })
  })

  test("setActiveEvent / setLiveSync are admin-only", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    const e1 = await t.mutation(internal.events.upsertImport, importArgs())
    const e2 = await t.mutation(internal.events.upsertImport, importArgs({ tbaKey: "2026other" }))
    expect((await a.as.query(api.events.active, {}))?._id).toBe(e2)
    await expect(b.as.mutation(api.events.setActiveEvent, { eventId: e1 })).rejects.toMatchObject(code("FORBIDDEN"))
    await a.as.mutation(api.events.setActiveEvent, { eventId: e1 })
    expect((await a.as.query(api.events.active, {}))?._id).toBe(e1)
    await expect(b.as.mutation(api.events.setLiveSync, { eventId: e1, enabled: false })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await a.as.mutation(api.events.setLiveSync, { eventId: e1, enabled: false })
    expect(await a.as.query(api.events.active, {})).toMatchObject({ liveSync: false })
  })

  test("importEvent / syncNow reject non-admins before fetching", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    await expect(b.as.action(api.events.importEvent, { tbaKey: "2026test" })).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(t.action(api.events.importEvent, { tbaKey: "2026test" })).rejects.toMatchObject(
      code("UNAUTHENTICATED"),
    )
    await expect(b.as.action(api.events.syncNow, { eventId })).rejects.toMatchObject(code("FORBIDDEN"))
  })

  test("syncNow throws SYNC_TOO_SOON within 60s of the last sync", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    await t.mutation(internal.events.applyInsights, { eventId, etags: {}, syncedAt: Date.now() })
    await expect(a.as.action(api.events.syncNow, { eventId })).rejects.toMatchObject(code("SYNC_TOO_SOON"))
  })

  test("applyInsights patches rankings and OPR independently", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    const insight = (team: number) =>
      t.run((ctx) =>
        ctx.db
          .query("teamInsights")
          .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", team))
          .unique(),
      )

    await t.mutation(internal.events.applyInsights, {
      eventId,
      rankings: [{ teamNumber: 1, rank: 2, rankingScore: 2.5, wins: 3, losses: 1, ties: 0, matchesPlayed: 4 }],
      etags: { rankings: "r1" },
      syncedAt: 1000,
    })
    expect(await insight(1)).toMatchObject({ rank: 2, rankingScore: 2.5, wins: 3, losses: 1, ties: 0, matchesPlayed: 4 })
    expect((await insight(1))?.opr).toBeUndefined()

    // OPR only (rankings 304): rankings fields preserved.
    await t.mutation(internal.events.applyInsights, {
      eventId,
      oprs: [
        { teamNumber: 1, opr: 42, dpr: 10, ccwm: 32 },
        { teamNumber: 2, opr: 17 },
      ],
      etags: { rankings: "r1", oprs: "o1" },
      syncedAt: 2000,
    })
    expect(await insight(1)).toMatchObject({ rank: 2, rankingScore: 2.5, wins: 3, opr: 42, dpr: 10, ccwm: 32 })
    expect(await insight(2)).toMatchObject({ opr: 17, wins: 0, losses: 0, ties: 0, matchesPlayed: 0 })
    expect((await insight(2))?.rank).toBeUndefined()

    // Rankings only again: OPR preserved.
    await t.mutation(internal.events.applyInsights, {
      eventId,
      rankings: [{ teamNumber: 1, rank: 1, rankingScore: 3, wins: 4, losses: 1, ties: 0, matchesPlayed: 5 }],
      etags: { rankings: "r2", oprs: "o1" },
      syncedAt: 3000,
    })
    expect(await insight(1)).toMatchObject({ rank: 1, wins: 4, opr: 42 })

    const event = await t.run((ctx) => ctx.db.get(eventId))
    expect(event).toMatchObject({ etags: { rankings: "r2", oprs: "o1" }, lastSyncAt: 3000 })
    expect(await a.as.query(api.events.active, {})).toMatchObject({ lastSyncAt: 3000 })
  })

  test("applyInsights with matches updates scores without duplicating", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    await t.mutation(internal.events.applyInsights, {
      eventId,
      matches: [{ tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6], redScore: 50, blueScore: 40 }],
      etags: {},
      syncedAt: 1,
    })
    const matches = await t.run((ctx) =>
      ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect(),
    )
    expect(matches).toHaveLength(2)
    expect(matches[0]).toMatchObject({ number: 1, redScore: 50, blueScore: 40 })
  })

  test("liveEventIds selects live events within startDate-1 .. endDate+1", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, importArgs())
    const at = (iso: string) => t.query(internal.events.liveEventIds, { now: Date.parse(iso) })
    expect(await at("2026-02-28T12:00:00Z")).toEqual([eventId])
    expect(await at("2026-03-04T12:00:00Z")).toEqual([eventId])
    expect(await at("2026-02-27T12:00:00Z")).toEqual([])
    expect(await at("2026-03-05T12:00:00Z")).toEqual([])
    await t.run((ctx) => ctx.db.patch(eventId, { liveSync: false }))
    expect(await at("2026-03-02T12:00:00Z")).toEqual([])
  })
})
