import { useQuery } from "convex/react"

import { api } from "../../convex/_generated/api"

export function HomeRoute() {
  const viewer = useQuery(api.users.viewer)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 p-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Home</h1>
      <p className="text-muted-foreground">
        Signed in{viewer?.email ? ` as ${viewer.email}` : ""}. Product features go here.
      </p>
    </div>
  )
}
