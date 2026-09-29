import type { ReactNode } from "react"

/** Bottom bar that stays visible while scrolling the scouting form. Place it last in the page. */
export function SubmitBar({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 -mb-4 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        {status && <div className="text-center text-sm text-muted-foreground">{status}</div>}
        <div className="flex gap-2">{children}</div>
      </div>
    </div>
  )
}
