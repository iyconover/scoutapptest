import { AlertCircleIcon, ImagePlusIcon, XIcon } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { MAX_PHOTOS_PER_TEAM } from "../../../convex/lib/constants"
import type { PitPhoto } from "./use-pit-photos"

/** "Add photos" button + thumbnail grid with per-photo progress and remove buttons. */
export function PitPhotos({
  photos,
  onAddFiles,
  onRemove,
  disabled = false,
}: {
  photos: PitPhoto[]
  onAddFiles: (files: File[]) => void
  onRemove: (key: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const full = photos.length >= MAX_PHOTOS_PER_TEAM

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          // Reset so picking the same file again still fires `change`.
          event.currentTarget.value = ""
          if (files.length > 0) onAddFiles(files)
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base"
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlusIcon className="size-5" />
        {full ? "Photo limit reached" : "Add photos"}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {photos.length}/{MAX_PHOTOS_PER_TEAM}
        </span>
      </Button>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={photo.key} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {photo.previewUrl ? (
                photo.status === "ready" ? (
                  <a href={photo.previewUrl} target="_blank" rel="noreferrer" className="block size-full">
                    <img
                      src={photo.previewUrl}
                      alt={`Robot photo ${index + 1}`}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <img
                    src={photo.previewUrl}
                    alt={`Robot photo ${index + 1}`}
                    className={cn("size-full object-cover", photo.status === "error" && "opacity-40")}
                  />
                )
              ) : null}

              {(photo.status === "compressing" || photo.status === "uploading") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 text-xs font-medium">
                  <Spinner className="size-6" />
                  {photo.status === "compressing" ? "Preparing" : "Uploading"}
                </div>
              )}
              {photo.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/10 text-xs font-medium text-destructive">
                  <AlertCircleIcon className="size-6" />
                  Failed
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-9 rounded-full shadow-sm"
                aria-label={`Remove photo ${index + 1}`}
                disabled={disabled}
                onClick={() => onRemove(photo.key)}
              >
                <XIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Take a photo or pick from your gallery. Photos are shrunk before uploading; removals apply when you save.
      </p>
    </div>
  )
}
