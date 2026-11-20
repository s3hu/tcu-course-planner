import type { Offering, Profile } from "./data";

export const TERM_HALVES = [
  { value: "first", label: "前半" },
  { value: "second", label: "後半" },
] as const;
export type TermHalf = (typeof TERM_HALVES)[number]["value"];

export function sanitizeTermHalves(value: unknown): TermHalf[] {
  return Array.isArray(value)
    ? TERM_HALVES.map(half => half.value).filter(half => value.includes(half))
    : [];
}

export function targetQuarters(term: Profile["term"], halves: TermHalf[] = []) {
  const firstQuarter = term === "前期" ? 1 : 3;
  return halves.length === 1
    ? [firstQuarter + (halves[0] === "second" ? 1 : 0)]
    : [firstQuarter, firstQuarter + 1];
}

export function matchesTermHalves(
  offering: Pick<Offering, "quarters">,
  term: Profile["term"],
  halves: TermHalf[] = [],
) {
  if (halves.length !== 1) return true;
  return targetQuarters(term, halves).some(q => offering.quarters.includes(q));
}
