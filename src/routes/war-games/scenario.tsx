import { useQuery } from "convex/react"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router"

import { NoEvent } from "@/components/no-event"
import { PageContainer } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PredictStep } from "@/components/war-games/predict-step"
import { ScenarioHeader } from "@/components/war-games/scenario-header"
import { SelectionStep } from "@/components/war-games/selection-step"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

type Step = "predict" | "alliances"
const STEP_PARAM = "step"

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>Scenario not found</EmptyTitle>
        <EmptyDescription>It may have been deleted, or it belongs to a different event.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" className="h-11 md:h-9" render={<Link to="/war-games" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />
          All scenarios
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export function WarGameRoute() {
  const warGameId = useParams().warGameId as Id<"warGames">
  const event = useQuery(api.events.active)
  const data = useQuery(api.warGames.get, { warGameId })
  const [params, setParams] = useSearchParams()
  const step: Step = params.get(STEP_PARAM) === "alliances" ? "alliances" : "predict"

  function setStep(value: unknown) {
    const next = new URLSearchParams(params)
    if (value === "alliances") next.set(STEP_PARAM, "alliances")
    else next.delete(STEP_PARAM)
    setParams(next, { replace: true })
  }

  return (
    <PageContainer wide>
      {event === undefined || data === undefined ? (
        <LoadingState />
      ) : event === null ? (
        <NoEvent />
      ) : data === null ? (
        <NotFound />
      ) : (
        <>
          <ScenarioHeader data={data} />
          <Tabs value={step} onValueChange={setStep} className="gap-4">
            <TabsList className="w-full group-data-horizontal/tabs:h-11 sm:w-fit">
              <TabsTrigger value="predict" className="px-3">
                1. Predict rankings
              </TabsTrigger>
              <TabsTrigger value="alliances" className="px-3">
                2. Alliance selection
              </TabsTrigger>
            </TabsList>
            <TabsContent value="predict">
              <PredictStep data={data} />
            </TabsContent>
            <TabsContent value="alliances">
              <SelectionStep data={data} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageContainer>
  )
}
