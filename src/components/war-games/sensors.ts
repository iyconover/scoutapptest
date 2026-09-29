import { PointerSensor, type PointerSensorOptions } from "@dnd-kit/core"
import type { PointerEvent as ReactPointerEvent } from "react"

/** Mouse/pen only: touch goes through the TouchSensor (long-press delay) so taps and scrolls don't drag. */
export class NonTouchPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}
