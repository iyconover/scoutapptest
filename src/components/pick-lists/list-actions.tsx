import { useMutation } from "convex/react"
import { EllipsisIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { errorMessage } from "@/lib/errors"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { LIST_NAME_MAX, plural, type ListSummary, type PickListOverview } from "./board-utils"

/** Personal lists only: re-apply the owner's own average ranks, after confirmation. */
export function RefreshFromRankingsButton({ list }: { list: ListSummary }) {
  const refresh = useMutation(api.pickLists.refreshFromRankings)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function onConfirm() {
    setPending(true)
    try {
      const { moved } = await refresh({ listId: list._id })
      toast.success(`Moved ${plural(moved, "team")}`)
      setOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" className="h-11 md:h-9" />}>
        <RefreshCwIcon />
        Refresh from my rankings
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refresh from your rankings?</AlertDialogTitle>
          <AlertDialogDescription>
            Teams you&apos;ve ranked move to the tier that matches your average rank (≤ 2 Tier 1, ≤ 4 Tier 2,
            otherwise Tier 3), even ones you placed by hand or in Do Not Pick. Teams you haven&apos;t ranked stay where they
            are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-8" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction className="h-11 md:h-8" disabled={pending} onClick={() => void onConfirm()}>
            {pending ? "Refreshing…" : "Refresh"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Rename / delete for the owner of a personal list. */
export function ListMenu({ list }: { list: ListSummary }) {
  const rename = useMutation(api.pickLists.rename)
  const remove = useMutation(api.pickLists.remove)
  const navigate = useNavigate()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(list.name)
  const [pending, setPending] = useState(false)
  const trimmed = name.trim()

  async function onRename(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || pending) return
    setPending(true)
    try {
      await rename({ listId: list._id, name: trimmed })
      toast.success("List renamed")
      setRenameOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  async function onDelete() {
    setPending(true)
    try {
      await remove({ listId: list._id })
      toast.success(`Deleted ${list.name}`)
      setDeleteOpen(false)
      void navigate("/pick-lists", { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" className="size-11 md:size-9" aria-label="List options" />}
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="min-h-10 md:min-h-8"
            onClick={() => {
              setName(list.name)
              setRenameOpen(true)
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-10 md:min-h-8" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onRename(e)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Rename list</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rename-list-name">Name</Label>
              <Input
                id="rename-list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={LIST_NAME_MAX}
                autoComplete="off"
                className="h-11 md:h-9"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" className="h-11 md:h-8" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                className="h-11 md:h-8"
                disabled={!trimmed || trimmed === list.name || pending}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {list.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the list and its layout. Other lists aren&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-8" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11 md:h-8"
              disabled={pending}
              onClick={() => void onDelete()}
            >
              {pending ? "Deleting…" : "Delete list"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Jump to any other list in the event. */
export function ListSwitcher({ currentId, overview }: { currentId: Id<"pickLists">; overview: PickListOverview }) {
  const navigate = useNavigate()
  const label = (l: ListSummary) => (l.kind === "personal" && l.ownerName ? `${l.name} · ${l.ownerName}` : l.name)
  const all = [...(overview.primary ? [overview.primary] : []), ...overview.mine, ...overview.others]
  const items = Object.fromEntries(all.map((l) => [l._id as string, label(l)]))

  const groups: { key: string; title: string; lists: ListSummary[] }[] = [
    { key: "primary", title: "Primary", lists: overview.primary ? [overview.primary] : [] },
    { key: "mine", title: "My lists", lists: overview.mine },
    { key: "others", title: "Others' lists", lists: overview.others },
  ]

  return (
    <Select
      items={items}
      value={currentId as string}
      onValueChange={(v) => {
        if (v && v !== currentId) void navigate(`/pick-lists/${v}`)
      }}
    >
      <SelectTrigger aria-label="Switch list" className="w-full min-w-0 data-[size=default]:h-11 sm:w-56 md:data-[size=default]:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups
          .filter((g) => g.lists.length > 0)
          .map((g) => (
            <SelectGroup key={g.key}>
              <SelectLabel>{g.title}</SelectLabel>
              {g.lists.map((l) => (
                <SelectItem key={l._id} value={l._id as string} className="min-h-10 md:min-h-8">
                  {label(l)}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
      </SelectContent>
    </Select>
  )
}
