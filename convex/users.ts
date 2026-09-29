import { getAuthUserId } from "@convex-dev/auth/server"
import { query } from "./_generated/server"

/** The signed-in user, or null when signed out. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    return userId === null ? null : await ctx.db.get(userId)
  },
})
