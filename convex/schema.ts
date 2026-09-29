import { authTables } from "@convex-dev/auth/server"
import { defineSchema } from "convex/server"

// Domain tables go here. `authTables` provides users, sessions, accounts, etc.
export default defineSchema({
  ...authTables,
})
