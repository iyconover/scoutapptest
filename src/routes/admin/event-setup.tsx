import { useAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { CalendarIcon, CheckIcon, DownloadIcon, RefreshCwIcon } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"

import { formatDateRange, formatRelative } from "@/components/home/time"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useNow } from "@/hooks/use-now"
import { errorMessage } from "@/lib/errors"
import { formatTime } from "@/lib/format"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { SYNC_CRON_MINUTES } from "../../../convex/lib/constants"

type ActiveEvent = NonNullable<FunctionReturnType<typeof api.events.active>>

function ImportCard() {
  const importEvent = useAction(api.events.importEvent)
  const [key, setKey] = useState("")
  const [pending, setPending] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const tbaKey = key.trim().toLowerCase()
    if (!tbaKey || pending) return
    setPending(true)
    try {
      const result = await importEvent({ tbaKey })
      toast.success(`Imported ${result.teams} teams and ${result.matches} matches`)
      setKey("")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Import from The Blue Alliance</CardTitle>
        <CardDescription>
          Pulls the event's teams and qualification schedule, then makes it the active event. Re-importing an
          existing key updates it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-2">
          <Label htmlFor="tba-key">TBA event key</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="tba-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="2026rikin"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={pending}
              className="h-11 font-mono sm:max-w-xs"
            />
            <Button type="submit" className="h-11 px-4" disabled={pending || key.trim() === ""}>
              {pending ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
              {pending ? "Importing…" : "Import"}
            </Button>
          </div>
          {pending && (
            <p className="text-sm text-muted-foreground">This can take several seconds while we talk to TBA.</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function ActiveEventCard({ event }: { event: ActiveEvent }) {
  const now = useNow(30_000)
  const setLiveSync = useMutation(api.events.setLiveSync)
  const syncNow = useAction(api.events.syncNow)
  const [togglePending, setTogglePending] = useState(false)
  const [syncPending, setSyncPending] = useState(false)

  const onToggle = async (enabled: boolean) => {
    setTogglePending(true)
    try {
      await setLiveSync({ eventId: event._id, enabled })
      toast.success(enabled ? "Live sync turned on" : "Live sync turned off")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setTogglePending(false)
    }
  }

  const onSync = async () => {
    setSyncPending(true)
    try {
      const { changed } = await syncNow({ eventId: event._id })
      toast.success(changed ? "Synced" : "Up to date")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSyncPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>Active event</CardDescription>
        <CardTitle className="text-lg">{event.name}</CardTitle>
        <CardAction>
          <Badge variant="secondary">Active</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Detail label="Key">
            <span className="font-mono">{event.tbaKey}</span>
          </Detail>
          <Detail label="Dates">{formatDateRange(event.startDate, event.endDate)}</Detail>
          <Detail label="Teams">{event.teamCount}</Detail>
          <Detail label="Schedule">{event.hasSchedule ? "Posted" : "Not posted yet"}</Detail>
        </dl>
        <Separator />
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="live-sync">Live sync</Label>
            <p className="text-sm text-muted-foreground">
              Pulls rankings, OPRs, scores and schedule changes from TBA every {SYNC_CRON_MINUTES} minutes while the
              event is running.
            </p>
          </div>
          <Switch
            id="live-sync"
            checked={event.liveSync}
            disabled={togglePending}
            onCheckedChange={(checked) => void onToggle(checked)}
            className="mt-1"
          />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Last synced{" "}
          {event.lastSyncAt === null ? (
            "never"
          ) : (
            <span title={formatTime(event.lastSyncAt)}>{formatRelative(event.lastSyncAt, now)}</span>
          )}
        </div>
        <Button variant="outline" className="h-11 px-4" disabled={syncPending} onClick={() => void onSync()}>
          {syncPending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Sync now
        </Button>
      </CardFooter>
    </Card>
  )
}

function EventsListCard({ activeId }: { activeId: Id<"events"> | null }) {
  const events = useQuery(api.events.list)
  const setActiveEvent = useMutation(api.events.setActiveEvent)
  const [pendingId, setPendingId] = useState<Id<"events"> | null>(null)

  const makeActive = async (eventId: Id<"events">, name: string) => {
    setPendingId(eventId)
    try {
      await setActiveEvent({ eventId })
      toast.success(`${name} is now the active event`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">All events</CardTitle>
        <CardDescription>Everything that has been imported. Only the active event is shown to scouters.</CardDescription>
      </CardHeader>
      <CardContent>
        {events === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events imported yet.</p>
        ) : (
          <ul className="-my-2 divide-y">
            {events.map((e) => {
              const isActive = e._id === activeId
              return (
                <li key={e._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{e.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{e.tbaKey}</span>
                      <span aria-hidden>·</span>
                      <CalendarIcon className="size-3" />
                      {formatDateRange(e.startDate, e.endDate)}
                    </span>
                  </div>
                  {isActive ? (
                    <Badge variant="secondary">
                      <CheckIcon />
                      Active
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-11 px-4"
                      disabled={pendingId !== null}
                      onClick={() => void makeActive(e._id, e.name)}
                    >
                      {pendingId === e._id && <Spinner data-icon="inline-start" />}
                      Make active
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function EventSetupRoute() {
  const active = useQuery(api.events.active)

  return (
    <PageContainer>
      <PageHeader title="Event Setup" description="Import events from The Blue Alliance and manage syncing." />
      <ImportCard />
      {active === undefined ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : active === null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No active event</CardTitle>
            <CardDescription>Import an event above, or make an existing one active below.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ActiveEventCard event={active} />
      )}
      <EventsListCard activeId={active?._id ?? null} />
    </PageContainer>
  )
}
