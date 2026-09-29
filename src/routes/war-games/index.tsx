import { useQuery } from "convex/react"
import { ChevronRightIcon, SwordsIcon } from "lucide-react"
import { Link } from "react-router"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { NewScenarioDialog } from "@/components/war-games/new-scenario-dialog"
import { METHOD_LABELS, type WarGameListItem } from "@/components/war-games/types"
import { api } from "../../../convex/_generated/api"

function formatCreated(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function ScenarioCard({ scenario }: { scenario: WarGameListItem }) {
  return (
    <Link
      to={`/war-games/${scenario._id}`}
      className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors group-hover:bg-muted/50">
        <CardContent className="flex min-h-11 items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate font-medium">{scenario.name}</span>
            <span className="text-xs text-muted-foreground">
              {scenario.createdByName} · {formatCreated(scenario.createdAt)}
            </span>
            <Badge variant="secondary">{METHOD_LABELS[scenario.method]}</Badge>
          </div>
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}

export function WarGamesIndexRoute() {
  const event = useQuery(api.events.active)
  const scenarios = useQuery(api.warGames.list)
  const loading = event === undefined || scenarios === undefined

  return (
    <PageContainer>
      <PageHeader
        title="War Games"
        description="Predict the remaining qualification results, then play out alliance selection from the predicted rankings."
        actions={event ? <NewScenarioDialog /> : undefined}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : event === null ? (
        <NoEvent />
      ) : scenarios.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SwordsIcon />
            </EmptyMedia>
            <EmptyTitle>No scenarios yet</EmptyTitle>
            <EmptyDescription>
              Create a scenario to predict the final rankings and simulate alliance selection. Make several to compare
              outcomes.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewScenarioDialog label="Create a scenario" />
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => (
            <ScenarioCard key={s._id} scenario={s} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
