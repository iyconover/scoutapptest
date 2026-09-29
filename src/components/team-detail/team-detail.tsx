import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ExternalLinkIcon, MapPinIcon, SearchXIcon } from "lucide-react"
import type { ReactNode } from "react"

import { MatchList } from "@/components/matches/match-list"
import { PhotoStrip } from "@/components/team-detail/photo-strip"
import { PitSummary } from "@/components/team-detail/pit-summary"
import { StatTile } from "@/components/team-detail/stat-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { formatEventRank, formatLocation, formatOpr, formatRank } from "@/lib/format"

import { api } from "../../../convex/_generated/api"
import { COLUMN_LABELS, type Column } from "../../../convex/lib/validators"

type Detail = NonNullable<FunctionReturnType<typeof api.teams.detail>>

const tierLabel = (tier: Column | null) => (tier === null ? "—" : COLUMN_LABELS[tier])

/** Everything we know about one team. Rendered inside the global team detail Dialog/Sheet. */
export function TeamDetail({ teamNumber }: { teamNumber: number }) {
  const detail = useQuery(api.teams.detail, { teamNumber })

  if (detail === undefined) return <TeamDetailSkeleton />
  if (detail === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Team {teamNumber} not found</EmptyTitle>
          <EmptyDescription>This team isn't registered for the current event.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return <TeamDetailBody detail={detail} />
}

function TeamDetailBody({ detail }: { detail: Detail }) {
  const { team, insights, pit, record, tier, notes, matches } = detail
  const location = formatLocation([team.city, team.stateProv, team.country])
  const rankingScore = insights?.rankingScore ?? null
  const matchesLabel =`${detail.matchesRanked} ${detail.matchesRanked === 1 ? "match" : "matches"}`

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-2 pr-8">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="font-heading text-2xl font-semibold tabular-nums">{team.number}</h2>
          <span className="min-w-0 text-lg font-medium break-words">{team.nickname}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {location && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPinIcon className="size-3.5" />
              {location}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-10 md:h-7"
            render={<a href={team.tbaUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            The Blue Alliance
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Our avg ranking" value={formatRank(detail.avgRank)} sub={matchesLabel} />
        <StatTile label="OPR (TBA)" value={formatOpr(detail.opr)} />
        <StatTile
          label="Event rank"
          value={formatEventRank(insights?.rank)}
          sub={rankingScore !== null ? `RS ${rankingScore.toFixed(2)}` : undefined}
        />
        <StatTile label="Record" value={`${record.wins}-${record.losses}-${record.ties}`} sub="W-L-T" />
        <StatTile label="Primary list" value={tierLabel(tier.primary)} />
        <StatTile label="My list" value={tierLabel(tier.mine)} />
      </div>

      <Section title="Robot photos">
        <PhotoStrip teamNumber={team.number} urls={pit?.photoUrls ?? []} />
      </Section>

      <Section title="Pit scouting">
        <PitSummary teamNumber={team.number} pit={pit} />
      </Section>

      <Section title="Match notes" count={notes.length}>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li
                key={`${note.matchNumber}-${note.createdAt}-${note.authorName}`}
                className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge variant="outline" className="tabular-nums">
                    Q{note.matchNumber}
                  </Badge>
                  <span className="font-medium">{note.authorName}</span>
                  {note.fromAssignment && <Badge variant="secondary">Assigned</Badge>}
                </div>
                <p className="text-sm break-words whitespace-pre-wrap">{note.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Matches" count={matches.length}>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
        ) : (
          <MatchList rows={matches} highlightTeam={team.number} />
        )}
      </Section>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
        {title}
        {count !== undefined && count > 0 && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
        )}
      </h3>
      {children}
    </section>
  )
}

function TeamDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-36" />
      <Skeleton className="h-28" />
    </div>
  )
}
