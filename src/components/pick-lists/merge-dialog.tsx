import { useMutation, useQuery } from "convex/react"
import { CombineIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/errors"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { COLUMN_LABELS, COLUMNS } from "../../../convex/lib/validators"
import { listOwnerLabel, plural, type ListSummary, type MergeRow, type PickListOverview } from "./board-utils"
import { QueryErrorBoundary } from "./query-error-boundary"

type ListId = Id<"pickLists">

function allLists(overview: PickListOverview): ListSummary[] {
  return [...(overview.primary ? [overview.primary] : []), ...overview.mine, ...overview.others]
}

/** Default sources: everyone's personal lists except the one being overwritten. */
function defaultSources(overview: PickListOverview, targetId: ListId): Set<ListId> {
  return new Set(
    [...overview.mine, ...overview.others].filter((l) => l._id !== targetId).map((l) => l._id),
  )
}

/** "Import & merge": pick source lists, preview the server's consensus, then apply it to the target. */
export function MergeDialog({ target, overview }: { target: ListSummary; overview: PickListOverview }) {
  const applyMerge = useMutation(api.pickLists.applyMerge)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<ListId>>(() => new Set())
  const [pending, setPending] = useState(false)

  const lists = allLists(overview)
  // Only send lists that still exist, so a list deleted elsewhere can't break the preview.
  const sourceListIds = lists.filter((l) => picked.has(l._id)).map((l) => l._id)

  function onOpenChange(next: boolean) {
    if (next) setPicked(defaultSources(overview, target._id))
    setOpen(next)
  }

  function toggle(id: ListId, checked: boolean) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function apply() {
    setPending(true)
    try {
      await applyMerge({ targetListId: target._id, sourceListIds })
      toast.success(`Merged ${plural(sourceListIds.length, "list")} into ${target.name}`)
      setOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="h-11 md:h-9" />}>
        <CombineIcon />
        Import &amp; merge
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import &amp; merge into {target.name}</DialogTitle>
          <DialogDescription>
            Consensus score averages each list&apos;s tier + position; a team goes to Do Not Pick if at least half
            of the lists that placed it did.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 grid min-h-0 gap-4 overflow-y-auto px-4 md:grid-cols-[16rem_minmax(0,1fr)]">
          <section className="flex flex-col gap-2" aria-labelledby="merge-sources-label">
            <div className="flex items-center justify-between gap-2">
              <h3 id="merge-sources-label" className="text-sm font-medium">
                Source lists
              </h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 md:h-7"
                  onClick={() => setPicked(new Set(lists.map((l) => l._id)))}
                >
                  All
                </Button>
                <Button variant="ghost" size="sm" className="h-11 md:h-7" onClick={() => setPicked(new Set())}>
                  None
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-1">
              {lists.map((l) => (
                <li key={l._id}>
                  <Label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 font-normal hover:bg-muted">
                    <Checkbox checked={picked.has(l._id)} onCheckedChange={(checked) => toggle(l._id, checked)} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {l.name}
                        {l._id === target._id && <span className="text-muted-foreground"> (this list)</span>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{listOwnerLabel(l)}</span>
                    </span>
                  </Label>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex min-w-0 flex-col gap-2" aria-labelledby="merge-preview-label">
            <h3 id="merge-preview-label" className="text-sm font-medium">
              Preview
            </h3>
            {sourceListIds.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Choose at least one list to preview the merge.
              </p>
            ) : (
              <QueryErrorBoundary
                key={sourceListIds.join(",")}
                fallback={
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Couldn&apos;t load the preview. Try a different selection.
                  </p>
                }
              >
                <MergePreview sourceListIds={sourceListIds} />
              </QueryErrorBoundary>
            )}
          </section>
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">
            Replaces the current layout of {target.name}.
          </p>
          <DialogClose render={<Button variant="outline" className="h-11 md:h-8" />}>Cancel</DialogClose>
          <Button
            className="h-11 md:h-8"
            disabled={sourceListIds.length === 0 || pending}
            onClick={() => void apply()}
          >
            {pending ? "Applying…" : "Apply to this list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MergePreview({ sourceListIds }: { sourceListIds: ListId[] }) {
  const rows = useQuery(api.pickLists.previewMerge, { sourceListIds })

  if (rows === undefined) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  // Keep the server's order within each column (tiers are sorted by consensus score).
  const byColumn = new Map(COLUMNS.map((c) => [c, [] as MergeRow[]]))
  for (const row of rows) byColumn.get(row.column)?.push(row)

  return (
    <div className="flex flex-col gap-3">
      {COLUMNS.map((column) => {
        const columnRows = byColumn.get(column) ?? []
        return (
          <div key={column} className="rounded-lg ring-1 ring-foreground/10">
            <div className="flex items-center justify-between border-b px-3 py-1.5">
              <span className="text-sm font-semibold">{COLUMN_LABELS[column]}</span>
              <Badge variant="secondary" className="tabular-nums">
                {columnRows.length}
              </Badge>
            </div>
            {columnRows.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No teams</p>
            ) : (
              <ol className="divide-y">
                {columnRows.map((row, i) => (
                  <li key={row.teamNumber} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="w-14 shrink-0 font-bold tabular-nums">{row.teamNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.nickname || "—"}</span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      <span className="font-medium">{row.score === null ? "—" : row.score.toFixed(2)}</span>
                      <span className="text-muted-foreground"> · {plural(row.votes, "vote")}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
    </div>
  )
}
