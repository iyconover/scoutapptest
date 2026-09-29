import { useQuery } from "convex/react"
import { SearchIcon, SearchXIcon, UsersIcon } from "lucide-react"
import { useMemo } from "react"
import { useSearchParams } from "react-router"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { PitTeamTile, type PitStatusRow } from "@/components/pit/pit-team-tile"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "../../../convex/_generated/api"

type Filter = "all" | "todo" | "done"
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "Not scouted" },
  { value: "done", label: "Scouted" },
]

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"

function parseFilter(value: string | null): Filter {
  return value === "todo" || value === "done" ? value : "all"
}

function matches(team: PitStatusRow, query: string, filter: Filter): boolean {
  if (filter === "todo" && team.scouted) return false
  if (filter === "done" && !team.scouted) return false
  if (!query) return true
  return String(team.teamNumber).startsWith(query) || team.nickname.toLowerCase().includes(query)
}

export function PitIndexRoute() {
  const event = useQuery(api.events.active)
  const grid = useQuery(api.pit.statusGrid)
  // Search + filter live in the URL so they survive a round trip to a team's form.
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const filter = parseFilter(params.get("show"))

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const teams = useMemo(() => [...(grid ?? [])].sort((a, b) => a.teamNumber - b.teamNumber), [grid])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teams.filter((t) => matches(t, q, filter))
  }, [teams, query, filter])

  if (event === null) {
    return (
      <PageContainer>
        <PageHeader title="Pit Scouting" />
        <NoEvent />
      </PageContainer>
    )
  }

  const loading = event === undefined || grid === undefined
  const scoutedCount = teams.filter((t) => t.scouted).length
  const total = teams.length
  const percent = total === 0 ? 0 : Math.round((scoutedCount / total) * 100)

  return (
    <PageContainer>
      <PageHeader title="Pit Scouting" description={event?.name} />

      <section aria-label="Progress" className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        {loading ? (
          <>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-lg font-semibold">
                <span className="tabular-nums">{scoutedCount}</span> of{" "}
                <span className="tabular-nums">{total}</span> scouted
              </p>
              <span className="text-sm text-muted-foreground tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Teams pit scouted"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={scoutedCount}
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setParam("q", e.currentTarget.value)}
            placeholder="Search team number or name"
            aria-label="Search teams"
            autoComplete="off"
            className="h-11 pl-9"
          />
        </div>
        <ToggleGroup
          aria-label="Filter teams"
          variant="outline"
          spacing={0}
          value={[filter]}
          onValueChange={(next: string[]) => {
            // Ignore deselecting the active filter; one is always selected.
            if (next.length === 0) return
            const picked = parseFilter(next[0] ?? null)
            setParam("show", picked === "all" ? null : picked)
          }}
          className="grid w-full grid-cols-3 sm:flex sm:w-auto"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              className="h-11 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
            >
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="min-h-32 rounded-xl" />
          ))}
        </div>
      ) : total === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No teams yet</EmptyTitle>
            <EmptyDescription>This event doesn't have a team list yet. Check back once it's published.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>No matching teams</EmptyTitle>
            <EmptyDescription>
              {filter === "todo" && !query ? "Every team has been pit scouted." : "Try a different search or filter."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className={GRID}>
          {visible.map((team) => (
            <li key={team.teamNumber}>
              <PitTeamTile team={team} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
