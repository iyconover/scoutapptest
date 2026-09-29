import { Loader2Icon } from "lucide-react"

export function FullPageSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
