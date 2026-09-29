import { ConvexError, type Value } from "convex/values"

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NO_ACTIVE_EVENT"
  | "INVALID_ARGUMENT"
  | "MATCH_CLOSED"
  | "INVALID_RANKING"
  | "ASSIGNED_IN_MATCH"
  | "ASSIGNMENT_CONFLICT"
  | "SYNC_TOO_SOON"
  | "TBA_ERROR"
  | "LAST_ADMIN"

export type AppErrorData = { code: ErrorCode; message: string; [key: string]: Value }

/** Every expected failure is thrown through this so the UI can toast `message`. */
export function appError(code: ErrorCode, message: string, extra: Record<string, Value> = {}) {
  return new ConvexError<AppErrorData>({ ...extra, code, message })
}
