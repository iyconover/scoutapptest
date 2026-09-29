import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ChevronLeftIcon, SearchXIcon } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { CheckCard, DrivetrainPicker, PitSection } from "@/components/pit/pit-form-fields"
import { PitPhotos } from "@/components/pit/pit-photos"
import type { PitStatusRow } from "@/components/pit/pit-team-tile"
import { usePitPhotos } from "@/components/pit/use-pit-photos"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"
import { api } from "../../../convex/_generated/api"
import { MAX_NOTE_LENGTH } from "../../../convex/lib/constants"
import type { Drivetrain, PitFields } from "../../../convex/lib/validators"

type PitReport = FunctionReturnType<typeof api.pit.get>

type BoolField = {
  [K in keyof PitFields]: PitFields[K] extends boolean ? K : never
}[keyof PitFields]
type Capabilities = Record<BoolField, boolean>

const SECTIONS: {
  title: string
  description?: string
  columns: string
  fields: { key: BoolField; label: string }[]
}[] = [
  {
    title: "Field capability",
    columns: "grid-cols-2",
    fields: [
      { key: "trench", label: "Trench" },
      { key: "bump", label: "Bump" },
    ],
  },
  {
    title: "Fuel capability",
    columns: "grid-cols-2",
    fields: [
      { key: "turret", label: "Turret" },
      { key: "dumper", label: "Dumper" },
      { key: "singleStream", label: "Single stream" },
      { key: "humanPlayerOnly", label: "Human player only" },
    ],
  },
  {
    title: "Climb capability",
    description: "Levels the robot can climb.",
    columns: "grid-cols-3",
    fields: [
      { key: "climbL1", label: "L1" },
      { key: "climbL2", label: "L2" },
      { key: "climbL3", label: "L3" },
    ],
  },
]

function parseTeamNumber(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,5}$/.test(raw)) return null
  const n = Number(raw)
  return n > 0 ? n : null
}

export function PitTeamRoute() {
  const teamNumber = parseTeamNumber(useParams().teamNumber)
  const event = useQuery(api.events.active)
  const grid = useQuery(api.pit.statusGrid)
  const report = useQuery(api.pit.get, teamNumber === null ? "skip" : { teamNumber })

  if (teamNumber === null) return <TeamNotFound />
  if (event === null) {
    return (
      <PageContainer>
        <BackLink />
        <NoEvent />
      </PageContainer>
    )
  }
  if (event === undefined || grid === undefined || report === undefined) return <FormSkeleton />

  const team = grid.find((t) => t.teamNumber === teamNumber)
  if (!team) return <TeamNotFound teamNumber={teamNumber} />

  // Keyed so switching teams resets the form state from the new report.
  return <PitForm key={teamNumber} team={team} report={report} />
}

function PitForm({ team, report }: { team: PitStatusRow; report: PitReport }) {
  const navigate = useNavigate()
  const save = useMutation(api.pit.save)
  const [caps, setCaps] = useState<Capabilities>(() => ({
    trench: report?.trench ?? false,
    bump: report?.bump ?? false,
    turret: report?.turret ?? false,
    dumper: report?.dumper ?? false,
    singleStream: report?.singleStream ?? false,
    humanPlayerOnly: report?.humanPlayerOnly ?? false,
    climbL1: report?.climbL1 ?? false,
    climbL2: report?.climbL2 ?? false,
    climbL3: report?.climbL3 ?? false,
  }))
  const [drivetrain, setDrivetrain] = useState<Drivetrain | null>(report?.drivetrain ?? null)
  const [notes, setNotes] = useState(report?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const photos = usePitPhotos(report?.photos ?? [])

  const failedCount = photos.photos.filter((p) => p.status === "error").length
  const canSave = drivetrain !== null && !photos.busy && !saving

  async function handleSave() {
    if (drivetrain === null) {
      toast.error("Pick a drivetrain before saving.")
      return
    }
    setSaving(true)
    try {
      await save({
        teamNumber: team.teamNumber,
        ...caps,
        drivetrain,
        notes: notes.trim(),
        photoIds: photos.photoIds,
      })
      toast.success(`Saved pit report for ${team.teamNumber}`)
      void navigate("/pit")
    } catch (e) {
      toast.error(errorMessage(e))
      setSaving(false)
    }
  }

  const saveHint = photos.busy
    ? "Waiting for photos to finish uploading…"
    : drivetrain === null
      ? "Pick a drivetrain to save."
      : failedCount > 0
        ? `${failedCount} failed photo${failedCount === 1 ? "" : "s"} won't be saved.`
        : null

  return (
    <>
      <PageContainer>
        <div className="flex flex-col gap-2">
          <BackLink />
          <PageHeader
            title={
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums">{team.teamNumber}</span>
                <span className="text-lg font-medium text-muted-foreground">{team.nickname}</span>
              </span>
            }
            description={report ? `Last updated by ${report.updatedByName}` : "Not scouted yet"}
          />
        </div>

        <form
          id="pit-form"
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) void handleSave()
          }}
        >
          {SECTIONS.map((section) => (
            <PitSection key={section.title} title={section.title} description={section.description}>
              <div className={`grid gap-2 ${section.columns}`}>
                {section.fields.map((field) => (
                  <CheckCard
                    key={field.key}
                    label={field.label}
                    checked={caps[field.key]}
                    disabled={saving}
                    onCheckedChange={(checked) => setCaps((prev) => ({ ...prev, [field.key]: checked }))}
                  />
                ))}
              </div>
            </PitSection>
          ))}

          <PitSection title="Drivetrain">
            <DrivetrainPicker value={drivetrain} onChange={setDrivetrain} disabled={saving} />
          </PitSection>

          <Separator />

          <PitSection title="Robot notes" description="Optional. Anything worth remembering.">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value.slice(0, MAX_NOTE_LENGTH))}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="e.g. fast intake, fragile climber, programmer is new"
              aria-label="Robot notes"
              rows={3}
              disabled={saving}
              className="min-h-24"
            />
            <p className="-mt-1 self-end text-xs text-muted-foreground tabular-nums">
              {notes.length}/{MAX_NOTE_LENGTH}
            </p>
          </PitSection>

          <PitSection title="Photos">
            <PitPhotos
              photos={photos.photos}
              onAddFiles={(files) => void photos.addFiles(files)}
              onRemove={photos.remove}
              disabled={saving}
            />
          </PitSection>
        </form>
      </PageContainer>

      <div className="sticky bottom-0 z-10 mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6">
          {saveHint && <p className="text-center text-xs text-muted-foreground">{saveHint}</p>}
          <Button type="submit" form="pit-form" className="h-12 w-full text-base" disabled={!canSave}>
            {saving || photos.busy ? <Spinner className="size-5" /> : null}
            {saving ? "Saving…" : "Save pit report"}
          </Button>
        </div>
      </div>
    </>
  )
}

function BackLink() {
  return (
    <Button
      variant="ghost"
      className="-ml-2 h-11 self-start px-2 text-muted-foreground"
      render={<Link to="/pit" />}
      nativeButton={false}
    >
      <ChevronLeftIcon className="size-5" />
      All teams
    </Button>
  )
}

function TeamNotFound({ teamNumber }: { teamNumber?: number }) {
  return (
    <PageContainer>
      <BackLink />
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>Team not found</EmptyTitle>
          <EmptyDescription>
            {teamNumber === undefined
              ? "That isn't a valid team number."
              : `Team ${teamNumber} isn't registered for this event.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button className="h-11" render={<Link to="/pit" />} nativeButton={false}>
            Back to pit scouting
          </Button>
        </EmptyContent>
      </Empty>
    </PageContainer>
  )
}

function FormSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-2">
        <BackLink />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      {[2, 4, 3].map((count, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: count }, (_, j) => (
              <Skeleton key={j} className="h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
      <Skeleton className="h-24 w-full rounded-lg" />
    </PageContainer>
  )
}
