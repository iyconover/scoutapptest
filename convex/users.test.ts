/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

type T = ReturnType<typeof convexTest>

async function newUser(t: T, email: string, profile = true) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  if (profile) await as.mutation(api.users.ensureProfile, {})
  return { userId, as }
}

const code = (c: string) => ({ data: expect.objectContaining({ code: c }) })

async function seedEvent(t: T) {
  return await t.mutation(internal.events.upsertImport, {
    tbaKey: "2026test",
    name: "Test Event",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    teams: [1, 2, 3, 4, 5, 6].map((n) => ({ tbaKey: `frc${n}`, number: n, nickname: `Team ${n}` })),
    matches: [{ tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6] }],
  })
}

describe("users", () => {
  test("first profile is admin, second is scouter; default display name from email", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    expect(await a.as.query(api.users.viewerProfile, {})).toEqual({
      userId: a.userId,
      displayName: "alice",
      role: "admin",
      isLeadScout: false,
    })
    expect(await b.as.query(api.users.viewerProfile, {})).toMatchObject({ role: "scouter" })
  })

  test("ensureProfile is idempotent and honours displayName on first call only", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com", false)
    await a.as.mutation(api.users.ensureProfile, { displayName: "  Alice   A " })
    await a.as.mutation(api.users.ensureProfile, { displayName: "Other" })
    await a.as.mutation(api.users.ensureProfile, {})
    const profiles = await t.run((ctx) => ctx.db.query("profiles").collect())
    expect(profiles).toHaveLength(1)
    expect(profiles[0]).toMatchObject({ displayName: "Alice A", role: "admin" })
  })

  test("ensureProfile requires auth", async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(api.users.ensureProfile, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })

  test("ensureProfile creates a personal list when an event is active", async () => {
    const t = convexTest(schema, modules)
    await newUser(t, "alice@example.com")
    await seedEvent(t)
    const b = await newUser(t, "bob@example.com")
    const lists = await t.run((ctx) => ctx.db.query("pickLists").collect())
    const bobs = lists.filter((l) => l.ownerId === b.userId)
    expect(bobs).toHaveLength(1)
    expect(bobs[0]).toMatchObject({ kind: "personal", name: "My list" })
    const entries = await t.run((ctx) =>
      ctx.db
        .query("pickListEntries")
        .withIndex("by_list_team", (q) => q.eq("listId", bobs[0]._id))
        .collect(),
    )
    expect(entries.map((e) => e.teamNumber).sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(entries.every((e) => e.column === "uncategorized")).toBe(true)
  })

  test("viewerProfile is null when signed out or without profile", async () => {
    const t = convexTest(schema, modules)
    expect(await t.query(api.users.viewerProfile, {})).toBeNull()
    const a = await newUser(t, "alice@example.com", false)
    expect(await a.as.query(api.users.viewerProfile, {})).toBeNull()
  })

  test("viewerProfile isLeadScout reflects the active event's lead scout", async () => {
    const t = convexTest(schema, modules)
    const admin = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    await seedEvent(t)
    await admin.as.mutation(api.events.setLeadScout, { userId: b.userId })
    expect(await b.as.query(api.users.viewerProfile, {})).toMatchObject({ isLeadScout: true })
    expect(await admin.as.query(api.users.viewerProfile, {})).toMatchObject({ isLeadScout: false })
  })

  test("setDisplayName updates self; validates length", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    await a.as.mutation(api.users.setDisplayName, { displayName: "Ally" })
    expect(await a.as.query(api.users.viewerProfile, {})).toMatchObject({ displayName: "Ally" })
    await expect(a.as.mutation(api.users.setDisplayName, { displayName: "   " })).rejects.toMatchObject(
      code("INVALID_ARGUMENT"),
    )
  })

  test("listProfiles requires auth and a profile, returns all profiles", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    await expect(t.query(api.users.listProfiles, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
    const noProfile = await newUser(t, "carol@example.com", false)
    await expect(noProfile.as.query(api.users.listProfiles, {})).rejects.toMatchObject(code("FORBIDDEN"))
    const list = await b.as.query(api.users.listProfiles, {})
    expect(list).toEqual([
      { userId: a.userId, displayName: "alice", role: "admin" },
      { userId: b.userId, displayName: "bob", role: "scouter" },
    ])
  })

  test("setRole is admin-only", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    await expect(b.as.mutation(api.users.setRole, { userId: b.userId, role: "admin" })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await a.as.mutation(api.users.setRole, { userId: b.userId, role: "admin" })
    expect(await b.as.query(api.users.viewerProfile, {})).toMatchObject({ role: "admin" })
  })

  test("setRole throws LAST_ADMIN when demoting the only admin, allows it with two", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const b = await newUser(t, "bob@example.com")
    await expect(a.as.mutation(api.users.setRole, { userId: a.userId, role: "scouter" })).rejects.toMatchObject(
      code("LAST_ADMIN"),
    )
    await a.as.mutation(api.users.setRole, { userId: b.userId, role: "admin" })
    await b.as.mutation(api.users.setRole, { userId: a.userId, role: "scouter" })
    expect(await a.as.query(api.users.viewerProfile, {})).toMatchObject({ role: "scouter" })
    await expect(b.as.mutation(api.users.setRole, { userId: b.userId, role: "scouter" })).rejects.toMatchObject(
      code("LAST_ADMIN"),
    )
  })

  test("setRole on unknown profile is NOT_FOUND", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "alice@example.com")
    const ghost = await newUser(t, "ghost@example.com", false)
    await expect(a.as.mutation(api.users.setRole, { userId: ghost.userId, role: "admin" })).rejects.toMatchObject(
      code("NOT_FOUND"),
    )
  })
})
