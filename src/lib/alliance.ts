export type AllianceColor = "red" | "blue"

/** Tailwind classes for red/blue alliance tinting (chips, rows, borders). */
export const allianceClasses: Record<AllianceColor, string> = {
  red: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
}
