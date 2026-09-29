import { useQuery } from "convex/react"
import { ClipboardListIcon, UsersIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { NewAssignmentCard } from "@/components/assignments/new-assignment-card"
import { ScouterAssignmentsCard } from "@/components/assignments/scouter-assignments-card"
import type { Assignment } from "@/components/assignments/types"
import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useViewer } from "@/hooks/use-viewer"

import { api } from "../../../convex/_generated/api"

export function AssignmentsRoute() {
  const event = useQuery(api.events.active)

  return (
    <PageContainer>
      <PageHeader
        title="Assignments"
        description="Assign scouters to watch specific teams. They'll write notes on those teams instead of ranking."
      />
      {event === undefined ? <AssignmentsSkeleton /> : event === null ? <NoEvent /> : <AssignmentsBody />}
    </PageContainer>
  )
}

function AssignmentsBody() {
  const viewer = useViewer()
  const profiles = useQuery(api.users.listProfiles)
  const teams = useQuery(api.teams.list, {})
  const assignments = useQuery(api.assignments.list)

  if (profiles === undefined || teams === undefined || assignments === undefined) return <AssignmentsSkeleton />

  const others = profiles.filter((p) => p.userId !== viewer?.userId)

  return (
    <>
      {others.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No scouters yet</EmptyTitle>
              <EmptyDescription>Teammates show up here once they sign up for the app.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <NewAssignmentCard profiles={profiles} teams={teams} assignments={assignments} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Current assignments</h2>
        {assignments.length === 0 ? (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>No assignments yet</EmptyTitle>
                <EmptyDescription>Assigned teams and their instructions will appear here, grouped by scouter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <AssignmentGroups assignments={assignments} />
        )}
      </section>
    </>
  )
}

function AssignmentGroups({ assignments }: { assignments: Assignment[] }) {
  const isDesktop = useIsDesktop()
  /** Explicit open/closed choices; unset groups start open on desktop and collapsed on phones. */
  const [openState, setOpenState] = useState<Record<string, boolean>>({})

  // The server already sorts by scouter name then team number; keep that order.
  const groups = useMemo(() => {
    const byScouter = new Map<string, Assignment[]>()
    for (const a of assignments) byScouter.set(a.scouterId, [...(byScouter.get(a.scouterId) ?? []), a])
    return [...byScouter.entries()].map(([scouterId, items]) => ({
      scouterId,
      scouterName: items[0].scouterName,
      items,
    }))
  }, [assignments])

  return (
    <div className="grid gap-3 md:grid-cols-2 md:items-start">
      {groups.map((g) => (
        <ScouterAssignmentsCard
          key={g.scouterId}
          scouterName={g.scouterName}
          assignments={g.items}
          open={openState[g.scouterId] ?? isDesktop}
          onOpenChange={(open) => setOpenState((s) => ({ ...s, [g.scouterId]: open }))}
        />
      ))}
    </div>
  )
}

function AssignmentsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="ml-auto h-11 w-full sm:w-28" />
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}
