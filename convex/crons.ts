import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"
import { SYNC_CRON_MINUTES } from "./lib/constants"

const crons = cronJobs()

// Rankings, OPRs and scores for live events. ETags keep this cheap for TBA.
crons.interval(
  "sync TBA insights",
  { minutes: SYNC_CRON_MINUTES },
  internal.events.syncActiveEvents,
  {},
)

export default crons
