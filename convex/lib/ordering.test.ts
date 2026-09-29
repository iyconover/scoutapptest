import { describe, expect, test } from "vitest"
import { orderBetween } from "./ordering"

describe("orderBetween", () => {
  test("empty column is 0", () => {
    expect(orderBetween()).toBe(0)
    expect(orderBetween(undefined, undefined)).toBe(0)
  })

  test("midpoint between two neighbours", () => {
    expect(orderBetween(1, 2)).toBe(1.5)
    expect(orderBetween(-1, 1)).toBe(0)
    expect(orderBetween(0, 0.5)).toBe(0.25)
  })

  test("after the last item", () => {
    expect(orderBetween(5)).toBe(6)
    expect(orderBetween(-2.5, undefined)).toBe(-1.5)
  })

  test("before the first item", () => {
    expect(orderBetween(undefined, 5)).toBe(4)
    expect(orderBetween(undefined, 0)).toBe(-1)
  })

  test("zero neighbours are treated as present", () => {
    expect(orderBetween(0)).toBe(1)
    expect(orderBetween(0, 1)).toBe(0.5)
  })

  test("repeated insertion stays strictly between", () => {
    let lo = 0
    const hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = orderBetween(lo, hi)
      expect(mid).toBeGreaterThan(lo)
      expect(mid).toBeLessThan(hi)
      lo = mid
    }
  })
})
