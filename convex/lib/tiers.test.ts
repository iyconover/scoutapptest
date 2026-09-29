import { describe, expect, test } from "vitest"
import { tierForAverage } from "./tiers"

describe("tierForAverage", () => {
  test("missing average is uncategorized", () => {
    expect(tierForAverage(null)).toBe("uncategorized")
    expect(tierForAverage(undefined)).toBe("uncategorized")
    expect(tierForAverage(Number.NaN)).toBe("uncategorized")
  })

  test("tier1 up to and including 2", () => {
    expect(tierForAverage(1)).toBe("tier1")
    expect(tierForAverage(1.5)).toBe("tier1")
    expect(tierForAverage(2)).toBe("tier1")
  })

  test("tier2 in (2, 4]", () => {
    expect(tierForAverage(2.01)).toBe("tier2")
    expect(tierForAverage(3)).toBe("tier2")
    expect(tierForAverage(4)).toBe("tier2")
  })

  test("tier3 above 4", () => {
    expect(tierForAverage(4.01)).toBe("tier3")
    expect(tierForAverage(5)).toBe("tier3")
    expect(tierForAverage(6)).toBe("tier3")
  })

  test("out-of-range values use the same thresholds", () => {
    expect(tierForAverage(0)).toBe("tier1")
    expect(tierForAverage(-3)).toBe("tier1")
    expect(tierForAverage(7)).toBe("tier3")
  })
})
