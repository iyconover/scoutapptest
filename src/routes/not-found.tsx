import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function NotFoundRoute() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <Button render={<Link to="/" />} nativeButton={false}>
        Go home
      </Button>
    </div>
  )
}
