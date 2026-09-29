import { v } from "convex/values"

import { query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { getActiveEvent, listMatches } from "./lib/event"
import { buildHistoryRows, historyRowV } from "./lib/history"

export const history = query({
  args: {},
  returns: v.array(historyRowV),
  handler: async (ctx) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    return await buildHistoryRows(ctx, event._id, await listMatches(ctx, event._id))
  },
})
