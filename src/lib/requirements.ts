import { rules, type PlannerState } from "./data";
import { completedSummary } from "./rules";

const academicMonth = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
});

export function progressionSummary(state: PlannerState, asOf: Date, earned = completedSummary(state)) {
  const parts = academicMonth.formatToParts(asOf);
  const year = Number(parts.find(part => part.type === "year")?.value);
  const month = Number(parts.find(part => part.type === "month")?.value);
  const months = Math.max(0, (year - state.profile.admissionYear) * 12 + month - 4);
  const completed = new Set(state.completed);
  const { to_year_3, enrollment_limits } = rules.progression;

  function check(label: string, condition: {
    minimum_graduation_countable_credits: number;
    minimum_enrolled_months_excluding_leave: number;
    prerequisite_course_ids?: string[];
  }) {
    const creditsRequired = condition.minimum_graduation_countable_credits;
    const monthsRequired = condition.minimum_enrolled_months_excluding_leave;
    const creditsRemaining = Math.max(0, creditsRequired - earned.total);
    const monthsRemaining = Math.max(0, monthsRequired - months);
    const prerequisites = condition.prerequisite_course_ids ?? [];
    const missing = prerequisites.filter(id => !completed.has(id));
    return { label, creditsRequired, monthsRequired, creditsRemaining, monthsRemaining, prerequisites, missing,
      met: creditsRemaining === 0 && monthsRemaining === 0 && missing.length === 0 };
  }

  return {
    months,
    limits: enrollment_limits,
    midyearProgressionAllowed: to_year_3.midyear_progression_allowed,
    checks: [
      check("3年次進級", to_year_3),
      check("事例研究(1)着手", to_year_3),
      check("卒業研究(1)着手", rules.progression["tcu2025-sm-own-9adaa58390b4"]),
    ],
  };
}
