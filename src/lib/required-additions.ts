import type { Course, Offering, Profile } from "./data";
import { inTarget } from "./rules";
import { selectRequiredSeeds } from "./required-solver";
import { matchesTermHalves, type TermHalf } from "./term-halves";

export type RequiredAdditions = {
  planned: string[];
  added: string[];
  skipped: { courseId: string; name: string; reasons: string[] }[];
};

export function planRequiredAdditions<T extends Offering>({
  required, offerings, profile, completed, planned, halves, issuesFor,
}: {
  required: Pick<Course, "id" | "name">[];
  offerings: T[];
  profile: Profile;
  completed: string[];
  planned: string[];
  halves?: TermHalf[];
  issuesFor: (offering: T, planned: string[]) => string[];
}): RequiredAdditions {
  const locked = offerings.filter(o => planned.includes(o.id));
  const settled = new Set([...completed, ...locked.map(o => o.courseId)]);
  const current = offerings.filter(o => inTarget(o, profile));
  const pending = required.filter(c => !settled.has(c.id)).flatMap(course => {
    const options = current.filter(o => o.courseId === course.id);
    if (!options.length) return [];
    const inScope = options.filter(o => matchesTermHalves(o, profile.term, halves));
    return [{ course, inScope, available: inScope.filter(o => issuesFor(o, planned).length === 0) }];
  });

  // A course with alternate sections can fit even when its first section clashes.
  const groups = pending.filter(item => item.available.length).map(({ course, available }) => ({
    courseId: course.id,
    current: false,
    choices: available.map(offering => ({ offering, load: 0 })),
  }));
  const seed = selectRequiredSeeds(groups, [], 0, Infinity, Infinity).seeds[0];
  const added = seed?.ids ?? [];
  const result = [...planned, ...added];
  const placedCourses = new Set(current.filter(o => added.includes(o.id)).map(o => o.courseId));
  const skipped = pending.filter(({ course }) => !placedCourses.has(course.id)).map(({ course, inScope }) => ({
    courseId: course.id,
    name: course.name,
    reasons: inScope.length
      ? [...new Set(inScope.flatMap(o => issuesFor(o, result)))]
      : ["対象タームの条件に合うクラスがありません"],
  }));
  return { planned: result, added, skipped };
}
