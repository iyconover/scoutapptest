import { useQuery } from "convex/react"
import { ArrowLeftIcon, EyeIcon, SearchIcon, SearchXIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { listOwnerLabel, plural } from "@/components/pick-lists/board-utils"
import { ListMenu, ListSwitcher, RefreshFromRankingsButton } from "@/components/pick-lists/list-actions"
import { MergeDialog } from "@/components/pick-lists/merge-dialog"
import { HighlightContext, matchTeams } from "@/components/pick-lists/highlight"
import { PickListBoard } from "@/components/pick-lists/pick-list-board"
import { Input } from "@/components/ui/input"
import { QueryErrorBoundary } from "@/components/pick-lists/query-error-boundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { COLUMNS } from "../../../convex/lib/validators"

function BackLink() {
  return (
    <Button
      variant="ghost"
      className="-ml-2 h-11 w-fit md:h-8"
      render={<Link to="/pick-lists" />}
      nativeButton={false}
    >
      <ArrowLeftIcon />
      All pick lists
    </Button>
  )
}

function ListNotFound() {
  return (
    <PageContainer>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Pick list not found</EmptyTitle>
          <EmptyDescription>It may have been deleted, or it belongs to a different event.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="h-11 md:h-9" render={<Link to="/pick-lists" />} nativeButton={false}>
            Back to pick lists
          </Button>
        </EmptyContent>
      </Empty>
    </PageContainer>
  )
}

/** Search box that highlights matching cards and scrolls the first one into view. */
function BoardSearch({
  entries,
  value,
  onChange,
  matches,
}: {
  entries: readonly { teamNumber: number; column: string; order: number }[]
  value: string
  onChange: (value: string) => void
  matches: ReadonlySet<number>
}) {
  // First match in board order (entries are already sorted by column, then position).
  const first = entries.find((e) => matches.has(e.teamNumber))?.teamNumber
  useEffect(() => {
    if (first === undefined) return
    document
      .querySelector(`[data-team="${first}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
  }, [first])

  const q = value.trim()
  return (
    // Pinned just under the app header (h-14) while the page scrolls.
    <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="relative w-full sm:w-72">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Find a team on this list"
          aria-label="Find a team on this list"
          className="h-11 pl-9 md:h-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {q !== "" && (
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {matches.size === 0 ? "No match" : matches.size === 1 ? "1 match" : `${matches.size} matches`}
        </span>
      )}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <PageContainer wide>
      <BackLink />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid auto-cols-[minmax(min(82vw,17rem),1fr)] grid-flow-col gap-3 overflow-hidden">
        {COLUMNS.map((c) => (
          <div key={c} className="flex flex-col gap-2 rounded-xl bg-muted/50 p-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

export function PickListRoute() {
  const { listId } = useParams()
  // A malformed id in the URL makes `get` throw on argument validation; show not-found instead.
  return (
    <QueryErrorBoundary key={listId} fallback={<ListNotFound />}>
      {listId ? <PickListPage listId={listId as Id<"pickLists">} /> : <ListNotFound />}
    </QueryErrorBoundary>
  )
}

function PickListPage({ listId }: { listId: Id<"pickLists"> }) {
  const event = useQuery(api.events.active)
  const data = useQuery(api.pickLists.get, { listId })
  const overview = useQuery(api.pickLists.overview)
  const [search, setSearch] = useState("")
  const matches = useMemo(() => matchTeams(data?.entries ?? [], search), [data?.entries, search])

  if (event === null) {
    return (
      <PageContainer>
        <PageHeader title="Pick List" />
        <NoEvent />
      </PageContainer>
    )
  }
  if (event === undefined || data === undefined) return <BoardSkeleton />
  if (data === null) return <ListNotFound />

  const { list, entries } = data
  const selectedCount = entries.filter((e) => e.selected).length
  const isOwnPersonal = list.kind === "personal" && list.canEdit

  return (
    <PageContainer wide>
      <BackLink />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{list.name}</span>
            {list.kind === "primary" && <Badge>Primary</Badge>}
            {!list.canEdit && (
              <Badge variant="outline">
                <EyeIcon />
                View only
              </Badge>
            )}
          </span>
        }
        description={
          <>
            {list.kind === "primary"
              ? `Team-wide list · ${list.canEdit ? "you can edit as an admin" : "only admins can edit"}`
              : isOwnPersonal
                ? "Your personal list"
                : listOwnerLabel(list)}
            {" · "}
            {plural(entries.length, "team")}
            {selectedCount > 0 && ` · ${selectedCount} selected`}
          </>
        }
        actions={
          <>
            {overview && <ListSwitcher currentId={list._id} overview={overview} />}
            {isOwnPersonal && <RefreshFromRankingsButton list={list} />}
            {list.canEdit && overview && <MergeDialog target={list} overview={overview} />}
            {isOwnPersonal && <ListMenu key={list._id} list={list} />}
          </>
        }
      />
      <p className="-mt-3 text-xs text-muted-foreground">
        {list.canEdit
          ? "Drag cards by the handle (long-press on touch) or use a card's menu to move it. Tap a team for details."
          : "You can view this list but not rearrange it. Tap a team for details."}{" "}
        Marking a team selected fades it on every list.
      </p>
      {entries.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No teams yet</EmptyTitle>
            <EmptyDescription>Teams appear here once the event&apos;s team list is imported.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <BoardSearch entries={entries} value={search} onChange={setSearch} matches={matches} />
          <HighlightContext.Provider value={matches}>
            <PickListBoard listId={list._id} entries={entries} canEdit={list.canEdit} />
          </HighlightContext.Provider>
        </>
      )}
    </PageContainer>
  )
}
