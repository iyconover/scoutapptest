import { ArrowLeftIcon, EyeIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/errors"
import type { WarGameData } from "./types"
import { useWarGameMutations } from "./use-war-game-mutations"

export function ScenarioHeader({ data }: { data: WarGameData }) {
  const { scenario, canEdit } = data
  const { rename, remove } = useWarGameMutations()
  const navigate = useNavigate()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(scenario.name)
  const [pending, setPending] = useState(false)

  async function onRename(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || pending) return
    setPending(true)
    try {
      await rename({ warGameId: scenario._id, name: trimmed })
      toast.success("Scenario renamed.")
      setRenameOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  async function onDelete() {
    if (pending) return
    setPending(true)
    try {
      await remove({ warGameId: scenario._id })
      toast.success("Scenario deleted.")
      setDeleteOpen(false)
      void navigate("/war-games")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-11 w-fit md:h-7"
        render={<Link to="/war-games" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        All scenarios
      </Button>
      <PageHeader
        title={scenario.name}
        description={`Created by ${scenario.createdByName}`}
        actions={
          canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" className="size-11 md:size-8" aria-label="Scenario actions" />}
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="min-h-11 md:min-h-8"
                  onClick={() => {
                    setName(scenario.name)
                    setRenameOpen(true)
                  }}
                >
                  <PencilIcon />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-11 md:min-h-8"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline">
              <EyeIcon />
              Read only
            </Badge>
          )
        }
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={(e) => void onRename(e)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Rename scenario</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="war-game-rename">Name</Label>
              <Input
                id="war-game-rename"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                maxLength={60}
                autoComplete="off"
                autoFocus
                className="h-11"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!name.trim() || pending} className="h-11 md:h-9">
                {pending && <Spinner data-icon="inline-start" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{scenario.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes its RP predictions and alliance board for everyone. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11 md:h-8"
              disabled={pending}
              onClick={() => void onDelete()}
            >
              {pending && <Spinner data-icon="inline-start" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
