/** A scouter counts as "active" if seen on match scouting within this window. */
export const PRESENCE_ACTIVE_MS = 60_000
/** How often the client sends a presence heartbeat. */
export const HEARTBEAT_MS = 20_000
/** Minimum gap between manual "Sync now" calls. */
export const SYNC_MIN_INTERVAL_MS = 60_000
/** Cron interval for TBA insight sync. */
export const SYNC_CRON_MINUTES = 10
/** A scouter may watch at most this many teams in one match. */
export const MAX_ASSIGNED_PER_MATCH = 2
export const DEFAULT_WIN_RP = 3
export const DEFAULT_TIE_RP = 1
export const ALLIANCE_COUNT = 8
export const ALLIANCE_SIZE = 3
/** Max photo edge length after on-device compression. */
export const PHOTO_MAX_PX = 1600
export const MAX_PHOTOS_PER_TEAM = 10
export const MAX_NOTE_LENGTH = 2000
