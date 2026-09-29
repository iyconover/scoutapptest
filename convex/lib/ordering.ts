/**
 * Fractional index strictly between two neighbours in a column.
 * (a+b)/2 when both exist, a+1 after the last item, b-1 before the first, 0 for an empty column.
 */
export function orderBetween(before?: number, after?: number): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2
  if (before !== undefined) return before + 1
  if (after !== undefined) return after - 1
  return 0
}
