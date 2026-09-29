import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { CrownIcon } from "lucide-react"

import { LeadScoutSelect } from "@/components/lead-scout-select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/use-now"
import { useIsAdmin, useViewer } from "@/hooks/use-viewer"
import { isActiveScouter, isOnline } from "@/lib/presence"
import { cn } from "@/lib/utils"

import { api } from "../../../convex/_generated/api"

type ActiveEvent = NonNullable<FunctionReturnType<typeof api.events.active>>
type PresenceRow = FunctionReturnType<typeof api.presence.list>[number]

function PersonRow({
  person,
  online,
  isLead,
  isYou,
}: {
  person: PresenceRow
  online: boolean
  isLead: boolean
  isYou: boolean
}) {
  return (
    <li className="flex min-h-10 items-center gap-2.5 py-1">
      <span
        aria-label={online ? "Online" : "Offline"}
        className={cn("size-2 shrink-0 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/30")}
      />
      <span className="min-w-0 flex-1 truncate">
        {person.displayName}
        {isYou && <span className="text-muted-foreground"> (you)</span>}
      </span>
      {isLead && (
        <Badge variant="default">
          <CrownIcon />
          Lead
        </Badge>
      )}
      <Badge variant={person.role === "admin" ? "secondary" : "outline"}>
        {person.role === "admin" ? "Admin" : "Scouter"}
      </Badge>
    </li>
  )
}

export function ScoutersCard({ event }: { event: ActiveEvent }) {
  const presence = useQuery(api.presence.list)
  const now = useNow(1000)
  const isAdmin = useIsAdmin()
  const viewerId = useViewer()?.userId
  const leadId = event.leadScout?.userId ?? null

  const active = presence?.filter((p) => isActiveScouter(p, now)) ?? []
  const inactive = presence?.filter((p) => !isActiveScouter(p, now)) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Scouters</CardTitle>
        <CardDescription>Who is on match scouting right now.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <CrownIcon className="size-3.5" />
            Lead scout
          </div>
          {isAdmin ? (
            <LeadScoutSelect value={leadId} />
          ) : (
            <p className="text-base font-semibold">{event.leadScout?.displayName ?? "Not chosen yet"}</p>
          )}
        </div>

        {presence === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">
                Actively scouting <span className="text-muted-foreground">({active.length})</span>
              </h3>
              {active.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">Nobody is scouting a match right now.</p>
              ) : (
                <ul className="flex flex-col">
                  {active.map((p) => (
                    <PersonRow
                      key={p.userId}
                      person={p}
                      online
                      isLead={p.userId === leadId}
                      isYou={p.userId === viewerId}
                    />
                  ))}
                </ul>
              )}
            </section>
            <Separator />
            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">
                Not scouting <span className="text-muted-foreground">({inactive.length})</span>
              </h3>
              {inactive.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">Everyone is scouting.</p>
              ) : (
                <ul className="flex flex-col">
                  {inactive.map((p) => (
                    <PersonRow
                      key={p.userId}
                      person={p}
                      online={isOnline(p, now)}
                      isLead={p.userId === leadId}
                      isYou={p.userId === viewerId}
                    />
                  ))}
                </ul>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                <span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" /> online elsewhere in the app
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
