// One-on-one rows are keyed by an ordered user pair, so both sides of a
// conversation resolve to the same row regardless of who is acting.
export function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
