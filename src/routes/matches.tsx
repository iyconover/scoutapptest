import { useQuery } from "convex/react"
import { CalendarClockIcon } from "lucide-react"

import { MatchList } from "@/components/matches/match-list"
import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

import { api } from "../../convex/_generated/api"

export function MatchesRoute() {
  const event = useQuery(api.events.active)
  const rows = useQuery(api.matches.history)

  if (event === null) {
    return (
      <PageContainer>
        <PageHeader title="Match History" />
        <NoEvent />
      </PageContainer>
    )
  }

  const played = rows?.filter((r) => r.redScore !== null && r.blueScore !== null).length ?? 0

  return (
    <PageContainer>
      <PageHeader
        title="Match History"
        description={
          rows === undefined || event === undefined
            ? "Qualification matches"
            : `${event.name} · ${rows.length} quals · ${played} played. Team chips show our average ranking and notes.`
        }
      />
      {rows === undefined ? (
        <MatchListSkeleton />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClockIcon />
            </EmptyMedia>
            <EmptyTitle>No matches yet</EmptyTitle>
            <EmptyDescription>
              The qualification schedule shows up here once it is published on The Blue Alliance or the lead
              scout adds a match.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <MatchList rows={rows} />
      )}
    </PageContainer>
  )
}

function MatchListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-xl md:h-14" />
      ))}
    </div>
  )
}
