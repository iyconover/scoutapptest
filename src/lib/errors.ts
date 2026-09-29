import { ConvexError } from "convex/values"

import type { AppErrorData, ErrorCode } from "../../convex/lib/errors"

/** User-facing message for any error thrown by a Convex call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<AppErrorData> | string
    if (typeof data === "string") return data
    if (data?.message) return data.message
  }
  return "Something went wrong. Please try again."
}

/** The `code` of an app error, or null for unexpected errors. */
export function errorCode(error: unknown): ErrorCode | null {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<AppErrorData> | string
    if (typeof data === "object" && data?.code) return data.code
  }
  return null
}
