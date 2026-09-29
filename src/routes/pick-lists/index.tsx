import { useQuery } from "convex/react"
import { ListChecksIcon, UsersIcon } from "lucide-react"
import type { ReactNode } from "react"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { type ListSummary } from "@/components/pick-lists/board-utils"
import { ListCard } from "@/components/pick-lists/list-card"
import { NewListDialog } from "@/components/pick-lists/new-list-dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "../../../convex/_generated/api"

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function groupByOwner(lists: ListSummary[]): [string, ListSummary[]][] {
  const groups = new Map<string, ListSummary[]>()
  for (const l of lists) {
    const owner = l.ownerName ?? "Unknown"
    groups.set(owner, [...(groups.get(owner) ?? []), l])
  }
  return [...groups.entries()]
}

export function PickListsIndexRoute() {
  const event = useQuery(api.events.active)
  const overview = useQuery(api.pickLists.overview)

  const header = (
    <PageHeader
      title="Pick Lists"
      description="Tier teams for alliance selection. Everyone can view every list; you edit your own."
      actions={overview ? <NewListDialog /> : undefined}
    />
  )

  if (event === null || overview === null) {
    return (
      <PageContainer>
        <PageHeader title="Pick Lists" />
        <NoEvent />
      </PageContainer>
    )
  }

  if (event === undefined || overview === undefined) {
    return (
      <PageContainer>
        {header}
        <Skeleton className="h-20 w-full" />
        <div className={GRID}>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <div className={GRID}>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </PageContainer>
    )
  }

  const others = groupByOwner(overview.others)

  return (
    <PageContainer>
      {header}

      <Section title="Primary list" description="The team-wide list used on draft day. Admin only editing.">
        {overview.primary ? (
          <ListCard
            list={overview.primary}
            note={overview.primary.canEdit ? "You're an admin" : "Admins edit"}
          />
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            The primary list hasn&apos;t been created for this event yet.
          </p>
        )}
      </Section>

      <Section title="My lists" description="Personal lists only you can edit.">
        {overview.mine.length > 0 ? (
          <div className={GRID}>
            {overview.mine.map((l) => (
              <ListCard key={l._id} list={l} />
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecksIcon />
              </EmptyMedia>
              <EmptyTitle>No personal lists yet</EmptyTitle>
              <EmptyDescription>Start one from your own match rankings, or from scratch.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewListDialog triggerLabel="Create my first list" />
            </EmptyContent>
          </Empty>
        )}
      </Section>

      <Section title="Others' lists" description="Read only. Merge them into your own list from its board.">
        {others.length > 0 ? (
          <div className="flex flex-col gap-4">
            {others.map(([owner, lists]) => (
              <div key={owner} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{owner}</h3>
                <div className={GRID}>
                  {lists.map((l) => (
                    <ListCard key={l._id} list={l} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon />
              </EmptyMedia>
              <EmptyTitle>No one else has a list yet</EmptyTitle>
              <EmptyDescription>Other scouters&apos; lists will show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Section>
    </PageContainer>
  )
}
