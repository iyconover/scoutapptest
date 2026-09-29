import type { FunctionReturnType } from "convex/server"
import { CalendarIcon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNow } from "@/hooks/use-now"

import { api } from "../../../convex/_generated/api"
import { formatDateRange, formatRelative } from "./time"

type ActiveEvent = NonNullable<FunctionReturnType<typeof api.events.active>>

export function EventCard({ event }: { event: ActiveEvent }) {
  const now = useNow(30_000)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{event.name}</CardTitle>
        <CardDescription className="font-mono">{event.tbaKey}</CardDescription>
        <CardAction>
          <Badge variant={event.liveSync ? "secondary" : "outline"}>
            <span
              aria-hidden
              className={event.liveSync ? "size-1.5 rounded-full bg-emerald-500" : "size-1.5 rounded-full bg-muted-foreground"}
            />
            Live sync {event.liveSync ? "on" : "off"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 shrink-0" />
          <span>{formatDateRange(event.startDate, event.endDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCwIcon className="size-4 shrink-0" />
          <span>
            Last synced {event.lastSyncAt === null ? "never" : formatRelative(event.lastSyncAt, now)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
