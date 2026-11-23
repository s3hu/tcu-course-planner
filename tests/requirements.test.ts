import assert from "node:assert/strict";
import test from "node:test";
import { courseById, DEFAULT_STATE, offerings, rules, type PlannerState } from "../src/lib/data";
import { progressionSummary } from "../src/lib/requirements";
import { projectedSummary } from "../src/lib/rules";

const april2027 = new Date("2027-04-01T00:00:00+09:00");
const april2028 = new Date("2028-04-01T00:00:00+09:00");
const thesis = rules.progression["tcu2025-sm-own-9adaa58390b4"];

function stateWithTotal(total: number, completed: string[] = []): PlannerState {
  const catalogCredits = completed.reduce((sum, id) => sum + courseById.get(id)!.credits, 0);
  return { ...DEFAULT_STATE, completed, customCompleted: [
    { name: "修得済み認定科目", category: "free_electives", credits: total - catalogCredits },
  ] };
}

test("year 3 and case study require both 66 earned credits and 24 months", () => {
  const [below, caseStudy] = progressionSummary(stateWithTotal(65), april2027).checks;
  assert.equal(below.creditsRemaining, 1);
  assert.equal(below.met, false);
  assert.equal(caseStudy.met, false);
  const atLimit = progressionSummary(stateWithTotal(66), april2027);
  assert.equal(atLimit.months, 24);
  assert.ok(atLimit.checks.slice(0, 2).every(check => check.met));
  assert.equal(atLimit.midyearProgressionAllowed, false);
  assert.equal(atLimit.limits.maximum_enrolled_months_through_year_2_excluding_leave, 48);
  assert.equal(atLimit.limits.maximum_total_enrolled_months_excluding_leave, 96);

  const early = progressionSummary(stateWithTotal(66), new Date(april2027.getTime() - 1));
  assert.equal(early.months, 23);
  assert.equal(early.checks[0].monthsRemaining, 1);
  assert.equal(early.checks[0].met, false);
});

test("thesis requires 100 earned credits, 36 months and both catalog prerequisites", () => {
  const prerequisites = thesis.prerequisite_course_ids;
  const thesisCheck = (state: PlannerState, date = april2028) => progressionSummary(state, date).checks[2];
  assert.equal(thesisCheck(stateWithTotal(99, prerequisites)).creditsRemaining, 1);
  assert.equal(thesisCheck(stateWithTotal(99, prerequisites)).met, false);
  assert.equal(thesisCheck(stateWithTotal(100, prerequisites)).met, true);
  assert.equal(thesisCheck(stateWithTotal(100, prerequisites), new Date(april2028.getTime() - 1)).monthsRemaining, 1);

  const onlyOne = stateWithTotal(100, prerequisites.slice(0, 1));
  onlyOne.customCompleted!.push({ name: courseById.get(prerequisites[1])!.name, category: "professional", credits: 2 });
  assert.deepEqual(thesisCheck(onlyOne).missing, prerequisites.slice(1));
  assert.equal(thesisCheck(onlyOne).met, false);
});

test("planned units raise projected credits without meeting earned progression thresholds", () => {
  const state = stateWithTotal(65);
  const opening = offerings.find(o => o.academicYear === 2026 && o.quarters.includes(3) &&
    courseById.get(o.courseId)?.creditStatus === "countable" && o.credits >= 1)!;
  state.planned = [opening.id];
  assert.ok(projectedSummary(state).total >= 66);
  assert.equal(progressionSummary(state, april2027).checks[0].met, false);
});
