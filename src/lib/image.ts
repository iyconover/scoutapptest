import { PHOTO_MAX_PX } from "../../convex/lib/constants"

const JPEG = "image/jpeg"

type Decoded = {
  image: ImageBitmap | HTMLImageElement
  width: number
  height: number
  release: () => void
}

/**
 * Shrinks a photo on-device before upload: the longest edge ends up ≤ `maxPx`
 * (never upscaled), EXIF orientation is applied, and the result is a JPEG.
 * If re-encoding would only make an already-small JPEG bigger, the original is returned.
 */
export async function compressImage(file: File, maxPx = PHOTO_MAX_PX, quality = 0.8): Promise<Blob> {
  const decoded = await decode(file)
  try {
    const { width, height } = decoded
    if (width <= 0 || height <= 0) throw new Error("Image has no size.")
    const scale = Math.min(1, maxPx / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const blob = await encodeJpeg(decoded.image, w, h, quality)
    if (blob.size > file.size && file.type === JPEG && scale === 1) return file
    return blob
  } finally {
    decoded.release()
  }
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Unsupported option or format: fall back to an <img> element.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error("This file isn't an image the browser can read.")
  }
}

function draw(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
) {
  // JPEG has no alpha: paint white so transparent areas don't turn black.
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, 0, 0, w, h)
}

async function encodeJpeg(
  image: ImageBitmap | HTMLImageElement,
  w: number,
  h: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext("2d")
    if (ctx) {
      draw(ctx, image, w, h)
      return await canvas.convertToBlob({ type: JPEG, quality })
    }
  }
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is not supported on this device.")
  draw(ctx, image, w, h)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the image."))),
      JPEG,
      quality,
    )
  })
}
