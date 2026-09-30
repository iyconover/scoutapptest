import { useQuery } from "convex/react"
import { SearchIcon, UsersIcon } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { TeamCompare } from "@/components/teams/team-compare"
import { TeamList } from "@/components/teams/team-list"
import {
  SORT_KEYS,
  SORT_LABELS,
  COMPARE_LABELS,
  COMPARE_METRICS,
  type CompareMetric,
  matchesSearch,
  defaultSort,
  sortTeams,
  type SortKey,
} from "@/components/teams/team-sort"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

type ListChoice = Id<"pickLists"> | "primary"

export function TeamsRoute() {
  const event = useQuery(api.events.active)
  // null = follow the default until the user picks a sort.
  const [chosenSort, setSort] = useState<SortKey | null>(null)
  const [listChoice, setListChoice] = useState<ListChoice>("primary")
  const [search, setSearch] = useState("")
  const [compare, setCompare] = useState(false)
  const [compareLeft, setCompareLeft] = useState<CompareMetric>("ourRank")
  const [compareRight, setCompareRight] = useState<CompareMetric>("opr")
  // Picking the metric the other side already shows swaps the two.
  const chooseLeft = (m: CompareMetric) => {
    if (m === compareRight) setCompareRight(compareLeft)
    setCompareLeft(m)
  }
  const chooseRight = (m: CompareMetric) => {
    if (m === compareLeft) setCompareLeft(compareRight)
    setCompareRight(m)
  }

  const overview = useQuery(api.pickLists.overview)
  const listOptions = useMemo(() => {
    const options: { value: ListChoice; label: string; group: "primary" | "mine" | "others" }[] = [
      { value: "primary", label: overview?.primary?.name ?? "Primary list", group: "primary" },
    ]
    for (const l of overview?.mine ?? []) options.push({ value: l._id, label: l.name, group: "mine" })
    for (const l of overview?.others ?? []) {
      options.push({ value: l._id, label: l.ownerName ? `${l.name} (${l.ownerName})` : l.name, group: "others" })
    }
    return options
  }, [overview])
  // Fall back to the primary list if the chosen list disappears.
  const effectiveList: ListChoice = listOptions.some((o) => o.value === listChoice) ? listChoice : "primary"

  // The default sort is never "tier", so only an explicit pick (or a compare column) needs a list.
  const usesList = chosenSort === "tier" || (compare && (compareLeft === "tier" || compareRight === "tier"))
  const teams = useQuery(
    api.teams.list,
    usesList && effectiveList !== "primary" ? { tierListId: effectiveList } : {},
  )

  const sort = chosenSort ?? defaultSort(teams)
  const concreteSort = sort
  const visible = useMemo(
    () => (teams ? sortTeams(teams, concreteSort).filter((t) => matchesSearch(t, search)) : undefined),
    [teams, concreteSort, search],
  )

  if (event === null) {
    return (
      <PageContainer>
        <PageHeader title="Teams" />
        <NoEvent />
      </PageContainer>
    )
  }

  const rankedCount = teams?.filter((t) => t.matchesRanked >= 1).length ?? 0
  const hints: string[] = []
  if (compare) {
    hints.push(`▲ = ${COMPARE_LABELS[compareLeft]} rates a team higher than ${COMPARE_LABELS[compareRight]} does, ▼ = lower.`)
  }
  const hint: ReactNode = hints.length > 0 ? hints.join(" ") : null

  const sortItems = Object.fromEntries(SORT_KEYS.map((k) => [k, SORT_LABELS[k]]))
  const listItems = Object.fromEntries(listOptions.map((o) => [o.value, o.label]))

  return (
    <PageContainer>
      <PageHeader
        title="Teams"
        description={
          event && teams ? `${event.name} · ${teams.length} teams · ${rankedCount} ranked` : "Every team at the event"
        }
      />

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div className="relative md:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            placeholder="Search number or name"
            aria-label="Search teams"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 md:h-9"
          />
        </div>

        <div className="flex gap-2">
          <Select items={sortItems} value={sort} onValueChange={(v) => v !== null && setSort(v)}>
            <SelectTrigger aria-label="Sort teams" className="h-11 min-w-0 flex-1 md:h-9 md:w-44 md:flex-none">
              <span className="text-muted-foreground">Sort:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="min-h-10 md:min-h-8">
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 md:h-9">
            <Switch checked={compare} onCheckedChange={setCompare} />
            Compare
          </Label>
        </div>

        {compare && (
          <div className="flex gap-2">
            <MetricSelect label="Left" value={compareLeft} onChange={chooseLeft} />
            <MetricSelect label="Right" value={compareRight} onChange={chooseRight} />
          </div>
        )}

        {usesList && (
          <Select<ListChoice>
            items={listItems}
            value={effectiveList}
            onValueChange={(v) => v !== null && setListChoice(v)}
          >
            <SelectTrigger aria-label="Pick list for tiers" className="h-11 w-full md:h-9 md:w-60">
              <span className="text-muted-foreground">List:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <ListGroup label="Primary" options={listOptions.filter((o) => o.group === "primary")} />
              <ListGroup label="My lists" options={listOptions.filter((o) => o.group === "mine")} />
              <ListGroup label="Others' lists" options={listOptions.filter((o) => o.group === "others")} />
            </SelectContent>
          </Select>
        )}
      </div>

      {hint && <p className="-mt-3 text-xs text-muted-foreground">{hint}</p>}

      {visible === undefined ? (
        <TeamListSkeleton />
      ) : teams !== undefined && teams.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No teams yet</EmptyTitle>
            <EmptyDescription>Teams appear once the event is imported from The Blue Alliance.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No teams match “{search.trim()}”.</p>
      ) : compare ? (
        <TeamCompare teams={visible} allTeams={teams ?? []} left={compareLeft} right={compareRight} />
      ) : (
        <TeamList teams={visible} showTier={concreteSort === "tier"} primary={concreteSort === "opr" || concreteSort === "eventRank" ? concreteSort : "rank"} />
      )}
    </PageContainer>
  )
}

function ListGroup({ label, options }: { label: string; options: { value: ListChoice; label: string }[] }) {
  if (options.length === 0) return null
  return (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value} className="min-h-10 md:min-h-8">
          {o.label}
        </SelectItem>
      ))}
    </SelectGroup>
  )
}

function TeamListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl md:h-10" />
      ))}
    </div>
  )
}

const metricItems = Object.fromEntries(COMPARE_METRICS.map((m) => [m, COMPARE_LABELS[m]]))

function MetricSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: CompareMetric
  onChange: (m: CompareMetric) => void
}) {
  return (
    <Select<CompareMetric> items={metricItems} value={value} onValueChange={(v) => v !== null && onChange(v)}>
      <SelectTrigger aria-label={`${label} compare column`} className="h-11 min-w-0 flex-1 md:h-9 md:w-52 md:flex-none">
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {COMPARE_METRICS.map((m) => (
          <SelectItem key={m} value={m} className="min-h-10 md:min-h-8">
            {COMPARE_LABELS[m]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
