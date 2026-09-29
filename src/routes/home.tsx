import { useQuery } from "convex/react"

import { CurrentMatchCard } from "@/components/home/current-match-card"
import { EventCard } from "@/components/home/event-card"
import { LastScoutedCard } from "@/components/home/last-scouted-card"
import { ProfileCard } from "@/components/home/profile-card"
import { ScoutersCard } from "@/components/home/scouters-card"
import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"

import { api } from "../../convex/_generated/api"

export function HomeRoute() {
  const event = useQuery(api.events.active)

  if (event === undefined) {
    return (
      <PageContainer>
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (event === null) {
    return (
      <PageContainer>
        <PageHeader title="Home" />
        <NoEvent />
        <div className="mx-auto w-full max-w-md">
          <ProfileCard />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader title="Home" />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <EventCard event={event} />
          <CurrentMatchCard />
          <LastScoutedCard />
        </div>
        <div className="flex flex-col gap-4">
          <ScoutersCard event={event} />
          <ProfileCard />
        </div>
      </div>
    </PageContainer>
  )
}
