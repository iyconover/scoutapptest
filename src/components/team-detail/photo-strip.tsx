import { ChevronLeftIcon, ChevronRightIcon, ImageOffIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

/** Horizontal snap-scroll strip of robot photos; tap one to view it larger. */
export function PhotoStrip({ teamNumber, urls }: { teamNumber: number; urls: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (urls.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        <ImageOffIcon className="size-4" />
        No photos
      </div>
    )
  }

  const current = openIndex === null ? null : urls[openIndex]
  const step = (by: number) =>
    setOpenIndex((i) => (i === null ? null : (i + by + urls.length) % urls.length))

  return (
    <>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`View photo ${i + 1} of ${urls.length}`}
            className="shrink-0 snap-start overflow-hidden rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <img
              src={url}
              alt={`Team ${teamNumber} robot, photo ${i + 1}`}
              loading="lazy"
              className="h-36 w-auto max-w-[70vw] object-cover md:h-40"
            />
          </button>
        ))}
      </div>

      <Dialog open={current !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-h-[92svh] gap-3 p-3 sm:max-w-3xl">
          <DialogTitle className="pr-8">
            Team {teamNumber} · photo {(openIndex ?? 0) + 1} of {urls.length}
          </DialogTitle>
          {current && (
            <img
              src={current}
              alt={`Team ${teamNumber} robot, photo ${(openIndex ?? 0) + 1}`}
              className="max-h-[75svh] w-full rounded-lg object-contain"
            />
          )}
          {urls.length > 1 && (
            <div className="flex justify-between gap-2">
              <Button variant="outline" className="h-11 md:h-8" onClick={() => step(-1)}>
                <ChevronLeftIcon data-icon="inline-start" />
                Previous
              </Button>
              <Button variant="outline" className="h-11 md:h-8" onClick={() => step(1)}>
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
