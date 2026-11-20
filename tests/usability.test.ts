import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STATE, offeringById, offerings, type Profile } from "../src/lib/data";
import {
  addHandbookRequiredOfferings, getHandbook, handbookCandidates, handbookDatasetId, handbookOfferingIssues,
  handbookOfferings, sanitizeHandbookState,
} from "../src/lib/handbooks";
import { evaluate, inTarget, overlaps, sanitizeState } from "../src/lib/rules";
import { addRequiredOfferings, generateSchedules, matchesPreferences } from "../src/lib/scheduling";
import { buildSlotIndex } from "../src/lib/slots";
import { targetQuarters, type TermHalf } from "../src/lib/term-halves";

const fresh = () => structuredClone(DEFAULT_STATE);
const q3 = offeringById.get("2026:yba712201")!;
const q4 = offeringById.get("2026:ybb711401")!;
const semester = offeringById.get("2026:ybz055301")!;
const handbook = getHandbook(2024)!;
const profile: Profile = { ...DEFAULT_STATE.profile, admissionYear: 2024 };
const handbookOpenings = handbookOfferings(handbook.year);

test("term halves use the profile semester and filter course and slot candidates by overlap", () => {
  assert.deepEqual(targetQuarters("前期", ["first"]), [1]);
  assert.deepEqual(targetQuarters("前期", ["second"]), [2]);
  assert.deepEqual(targetQuarters("後期", ["first"]), [3]);
  assert.deepEqual(targetQuarters("後期", ["second"]), [4]);
  const state = fresh();
  const candidateIds = () => offerings.filter(o => inTarget(o, state.profile) && matchesPreferences(o, state)).map(o => o.id);
  const q4Rows = () => [...buildSlotIndex(state, 4).values()].flat();
  const unfiltered = candidateIds();
  for (const opening of [q3, q4, semester]) assert.ok(unfiltered.includes(opening.id));
  assert.ok(q4Rows().some(row => row.offering.id === q4.id));

  state.preferences.halves = ["first"];
  assert.ok(candidateIds().includes(q3.id));
  assert.ok(candidateIds().includes(semester.id));
  assert.ok(!candidateIds().includes(q4.id));
  assert.ok(!q4Rows().some(row => row.offering.id === q4.id));
  assert.ok(q4Rows().some(row => row.offering.id === semester.id));
  state.planned = [q4.id];
  assert.ok(q4Rows().some(row => row.offering.id === q4.id && row.selected));
  state.preferences.halves = ["second"];
  assert.ok(candidateIds().includes(semester.id));
  state.preferences.halves = ["second", "first"];
  assert.deepEqual(candidateIds(), unfiltered);
});

test("handbook slot candidates exclude Q4-only classes and keep semester-long classes", () => {
  for (const opening of [q4, semester]) {
    const mapped = handbookOpenings.find(o => o.sourceOfferingId === opening.id)!;
    const slot = mapped.slots.find(s => s.quarters.includes(4))!;
    const find = (halves: TermHalf[]) =>
      handbookCandidates(handbook, profile, 4, slot.day, slot.period, [], [], "all", halves)
        .some(row => row.offering.id === mapped.id);
    assert.ok(find([]));
    assert.ok(find(["second"]));
    assert.equal(find(["first"]), opening === semester);
  }
});

test("plan JSON round trips term halves in both modes and accepts older exports", () => {
  const state = fresh();
  delete state.preferences.halves;
  assert.deepEqual(sanitizeState(state)?.preferences.halves, []);
  state.preferences.halves = ["second"];
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(state)))?.preferences.halves, ["second"]);
  const olderPlan = { version: 1, datasetId: "tcu-handbooks-v1", profile, completed: [], planned: [], campus: "all" };
  assert.deepEqual(sanitizeHandbookState(olderPlan), {...olderPlan, datasetId: handbookDatasetId(profile)});
  const exported = JSON.stringify({ ...olderPlan, halves: ["second", "first", "second", "invalid"] });
  assert.deepEqual(sanitizeHandbookState(JSON.parse(exported))?.halves, ["first", "second"]);
});

test("generation limits new required and elective offerings to the selected half and keeps fixed plans", () => {
  for (const half of ["first", "second"] as const) {
    const state = fresh();
    state.preferences.halves = [half];
    const quarter = half === "first" ? 3 : 4;
    const locked = half === "first" ? q4 : q3;
    state.planned = [locked.id];
    const result = generateSchedules(state, { targetCredits: 12, preserveExisting: true });
    assert.ok(result.drafts.length);
    for (const draft of result.drafts) {
      assert.ok(draft.planned.includes(locked.id));
      assert.ok(draft.planned.some(id => id !== locked.id));
      assert.ok(draft.planned.every(id => id === locked.id || offeringById.get(id)!.quarters.includes(quarter)));
      assert.equal(draft.currentRequiredScheduled, draft.currentRequiredTotal);
    }
  }
});

test("required batch adds all nonconflicting courses and skips completed, placed and conflicting courses", () => {
  const state = fresh();
  const empty = addRequiredOfferings(state);
  assert.equal(empty.added.length, 5);
  assert.equal(empty.skipped.length, 1);
  assert.match(empty.skipped[0].reasons.join(" "), /時間が重なる/);
  assert.equal(addRequiredOfferings({ ...state, planned: empty.planned }).added.length, 0);

  const clash = offerings.find(o => o.courseId !== q3.courseId && overlaps(o, q3) &&
    evaluate(o, state).status !== "blocked" && !empty.added.includes(o.id))!;
  state.completed = [semester.courseId];
  state.planned = [q4.id, clash.id];
  const result = addRequiredOfferings(state);
  assert.deepEqual(result.planned.slice(0, 2), state.planned);
  assert.ok(result.added.length);
  assert.ok(result.added.every(id => ![q3.id, q4.id, semester.id].includes(id)));
  assert.ok(result.skipped.some(item => item.courseId === q3.courseId && item.reasons.some(reason => reason.includes(clash.name))));
  assert.ok(result.skipped.every(item => item.courseId !== q4.courseId && item.courseId !== semester.courseId));
});

test("handbook required batch honors the selected half and checks every meeting", () => {
  const mapped = (id: string) => handbookOpenings.find(o => o.sourceOfferingId === id)!;
  const q4Opening = mapped(q4.id);
  const span = mapped(semester.id);
  const completed = [mapped(q3.id).courseId];
  const planned = [q4Opening.id];
  const result = addHandbookRequiredOfferings(handbook, profile, completed, planned, "all", ["first"]);
  assert.equal(result.planned[0], q4Opening.id);
  assert.ok(result.added.includes(span.id));
  assert.ok(result.added.every(id => {
    const o = handbookOpenings.find(o => o.id === id)!;
    return o.quarters.includes(3) && handbookOfferingIssues(handbook, o, profile, completed, result.planned).length === 0;
  }));
  assert.ok(result.skipped.some(item => item.reasons.some(reason => reason.includes("対象ターム"))));
  assert.ok(result.skipped.every(item => item.courseId !== q4Opening.courseId && !completed.includes(item.courseId)));
});
