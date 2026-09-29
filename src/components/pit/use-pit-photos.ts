import { useMutation } from "convex/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/lib/errors"
import { compressImage } from "@/lib/image"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MAX_PHOTOS_PER_TEAM } from "../../../convex/lib/constants"

export type PitPhoto = {
  key: string
  /** Set once the file is in Convex storage (always set for existing photos). */
  storageId: Id<"_storage"> | null
  /** Displayable URL: the storage URL, or a local object URL for new uploads. */
  previewUrl: string | null
  status: "compressing" | "uploading" | "ready" | "error"
}

let nextKey = 0
const newKey = () => `new-${++nextKey}`

/**
 * Local photo list for the pit form. Existing photos come from `pit.get`;
 * new files are compressed and uploaded right away, but are only attached to
 * the report (and removed ones deleted by the server) when the form is saved.
 */
export function usePitPhotos(initial: { storageId: Id<"_storage">; url: string }[]) {
  const [photos, setPhotos] = useState<PitPhoto[]>(() =>
    initial.map((p) => ({ key: p.storageId, storageId: p.storageId, previewUrl: p.url, status: "ready" })),
  )
  const generateUploadUrl = useMutation(api.pit.generateUploadUrl)
  const objectUrls = useRef(new Set<string>())

  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const patch = useCallback((key: string, change: Partial<PitPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...change } : p)))
  }, [])

  const upload = useCallback(
    async (key: string, file: File) => {
      const fail = (description: string) => {
        patch(key, { status: "error" })
        toast.error(`Couldn't add ${file.name || "photo"}`, { description })
      }

      let blob: Blob
      try {
        blob = await compressImage(file)
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Could not read the image.")
      }
      const previewUrl = URL.createObjectURL(blob)
      objectUrls.current.add(previewUrl)
      patch(key, { previewUrl, status: "uploading" })

      let uploadUrl: string
      try {
        uploadUrl = await generateUploadUrl()
      } catch (e) {
        return fail(errorMessage(e))
      }
      try {
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        })
        if (!res.ok) throw new Error(String(res.status))
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> }
        patch(key, { storageId, status: "ready" })
      } catch {
        fail("Upload failed. Check your connection and try again.")
      }
    },
    [generateUploadUrl, patch],
  )

  /** Queue files for compression + upload, respecting MAX_PHOTOS_PER_TEAM. */
  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type === "" || f.type.startsWith("image/"))
      if (images.length < files.length) toast.error("Only image files can be added.")
      const room = MAX_PHOTOS_PER_TEAM - photos.length
      if (room <= 0) {
        toast.error(`A team can have at most ${MAX_PHOTOS_PER_TEAM} photos.`)
        return
      }
      const accepted = images.slice(0, room)
      if (accepted.length < images.length) {
        toast.warning(`Only ${room} more photo${room === 1 ? "" : "s"} allowed, so the rest were skipped.`)
      }
      const queued = accepted.map((file) => ({ key: newKey(), file }))
      setPhotos((prev) => [
        ...prev,
        ...queued.map(({ key }): PitPhoto => ({ key, storageId: null, previewUrl: null, status: "compressing" })),
      ])
      // One at a time keeps memory low on phones while decoding large photos.
      for (const { key, file } of queued) await upload(key, file)
    },
    [photos.length, upload],
  )

  const remove = useCallback((key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key)
      if (target?.previewUrl && objectUrls.current.has(target.previewUrl)) {
        URL.revokeObjectURL(target.previewUrl)
        objectUrls.current.delete(target.previewUrl)
      }
      return prev.filter((p) => p.key !== key)
    })
  }, [])

  const busy = photos.some((p) => p.status === "compressing" || p.status === "uploading")
  const photoIds = photos.flatMap((p) => (p.status === "ready" && p.storageId ? [p.storageId] : []))

  return { photos, photoIds, busy, addFiles, remove }
}
