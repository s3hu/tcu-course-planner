import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CreditTagFilter from "../src/components/credit-tag-filter";
import { CREDIT_TAGS } from "../src/lib/credit-tags";
import { DEFAULT_STATE, courseById, courses, offeringById, offerings, requirement } from "../src/lib/data";
import { DESIGN_DATA_SCIENCE, DESIGN_FACULTY, getHandbook, sanitizeHandbookState } from "../src/lib/handbooks";
import { sanitizeState } from "../src/lib/rules";
import { generateSchedules, matchesCampus, matchesPreferences } from "../src/lib/scheduling";
import { buildSlotIndex, candidatesAt, slotId } from "../src/lib/slots";

test("legacy plans restore an empty filter and produce the same candidates and drafts", () => {
  const { creditTagIds, ...preferences } = DEFAULT_STATE.preferences;
  const restored = sanitizeState({ ...DEFAULT_STATE, preferences });
  assert.ok(restored);
  assert.deepEqual(restored.preferences.creditTagIds, creditTagIds);
  assert.deepEqual(
    offerings.filter(o => matchesPreferences(o, restored)).map(o => o.id),
    offerings.filter(o => matchesCampus(o, DEFAULT_STATE.preferences.campus)).map(o => o.id),
  );
  const options = { targetCredits: 12, preserveExisting: false };
  assert.deepEqual(generateSchedules(restored, options), generateSchedules(DEFAULT_STATE, options));
});

test("course and slot candidates use OR across unit categories and requirements", () => {
  const state = structuredClone(DEFAULT_STATE);
  state.preferences.creditTagIds = ["physical_education", "foreign_language_required"];
  const includesEither = (courseId: string) => {
    const { category, requiredType } = courseById.get(courseId)!;
    return category === "physical_education" || (category === "foreign_language" && requiredType === "required");
  };
  const baseline = offerings.filter(o => matchesPreferences(o, DEFAULT_STATE));
  const filtered = offerings.filter(o => matchesPreferences(o, state));
  assert.deepEqual(filtered, baseline.filter(o => includesEither(o.courseId)));
  assert.ok(filtered.some(o => courseById.get(o.courseId)!.category === "physical_education"));
  assert.ok(filtered.some(o => courseById.get(o.courseId)!.category === "foreign_language"));
  for (const [key, rows] of buildSlotIndex(DEFAULT_STATE, 3)) {
    const [day, period] = key.split(":").map(Number);
    assert.deepEqual(candidatesAt(state, { day, period, quarter: 3 }),
      rows.filter(row => includesEither(row.offering.courseId)));
  }
});

test("a nonmatching fixed course stays on the timetable while disappearing from the slot candidates", () => {
  const state = structuredClone(DEFAULT_STATE);
  const slot = { day: 1, period: 2, quarter: 3 };
  const id = "2026:yba712201";
  state.planned = [id];
  state.preferences.creditTagIds = ["foreign_language_required"];
  assert.ok(buildSlotIndex(state, slot.quarter).get(slotId(slot.day, slot.period))?.some(row => row.selected && row.offering.id === id));
  assert.ok(candidatesAt(state, slot).every(row => row.offering.id !== id));
  const options = { targetCredits: 12, preserveExisting: true };
  const baseline = generateSchedules(DEFAULT_STATE, options).drafts[0];
  const elective = baseline?.planned.find(id => !requirement.mandatoryIds.includes(offeringById.get(id)!.courseId));
  assert.ok(elective);
  state.planned.push(elective);
  const { drafts } = generateSchedules(state, options);
  assert.ok(drafts.length);
  assert.ok(drafts.every(draft => draft.planned.includes(id) && draft.planned.includes(elective)));
});

test("automation limits new electives and retains current required courses outside the filter", () => {
  const state = structuredClone(DEFAULT_STATE);
  state.preferences.creditTagIds = ["physical_education", "liberal_arts"];
  const options = { targetCredits: 20, preserveExisting: false };
  const { drafts, required } = generateSchedules(state, options);
  const current = required.filter(item => item.current && item.status !== "completed");
  assert.ok(current.length);
  assert.ok(drafts.length);
  for (const draft of drafts) {
    const planned = draft.planned.map(id => courseById.get(offeringById.get(id)!.courseId)!);
    assert.ok(current.every(item => planned.some(course => course.id === item.courseId)));
    const electives = planned.filter(course => !requirement.mandatoryIds.includes(course.id));
    assert.ok(electives.length);
    assert.ok(electives.every(course => course.category === "physical_education" || course.category === "liberal_arts"));
  }
  state.preferences.creditTagIds = ["required"];
  const requiredOnly = generateSchedules(state, options).drafts;
  assert.ok(requiredOnly.length);
  assert.ok(requiredOnly.every(draft => draft.planned.every(id => requirement.mandatoryIds.includes(offeringById.get(id)!.courseId))));
});

test("foreign-language required is a separate requirement tag on exactly the qualifying courses", () => {
  const handbook = getHandbook(2026)!;
  assert.equal(CREDIT_TAGS.foreign_language_required.label, "外国語（必修）");
  assert.equal(CREDIT_TAGS.foreign_language_required.kind, "requirement");
  for (const course of [...courses, ...handbook.courses]) {
    assert.equal(course.creditTagIds.includes("foreign_language_required"),
      course.category === "foreign_language" && course.requiredType === "required", course.name);
  }
});

test("filter chips show only matching kinds and tags present in the profile catalog", () => {
  const handbook = getHandbook(2025, DESIGN_DATA_SCIENCE, DESIGN_FACULTY)!;
  const renderChips = (scope: typeof courses) => renderToStaticMarkup(createElement(CreditTagFilter, {
    courses: scope, selectedIds: ["foreign_language_required"], onChange: () => {},
  }));
  const designChips = renderChips(handbook.courses);
  const plannerChips = renderChips(courses);
  for (const label of ["大区分", "内訳", "履修区分", "外国語（必修）"]) {
    assert.ok(designChips.includes(label), label);
  }
  assert.match(designChips, /aria-pressed="true"[^>]*>.*?外国語（必修）<\/button>/);
  for (const label of ["基礎科目", "体育科目", "DS対象"]) {
    assert.ok(!designChips.includes(">" + label + "</button>"), label);
  }
  for (const label of ["基礎科目", "体育科目", "必修", "選択必修"]) {
    assert.ok(plannerChips.includes(">" + label + "</button>"), label);
  }
});

test("planner and handbook exports restore valid profile tags and discard unavailable selections", () => {
  const selections = ["foreign_language_required", "physical_education", "foreign_language_required", "DS", "unknown"];
  const state = { ...DEFAULT_STATE, preferences: { ...DEFAULT_STATE.preferences, creditTagIds: selections } };
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(state)))?.preferences.creditTagIds,
    ["foreign_language_required", "physical_education"]);
  const handbookState = {
    version: 1, datasetId: "tcu-handbooks-v1", completed: [], planned: [], campus: "all",
    profile: { ...DEFAULT_STATE.profile, department: DESIGN_DATA_SCIENCE, faculty: DESIGN_FACULTY },
    creditTagIds: selections,
  };
  assert.deepEqual(sanitizeHandbookState(JSON.parse(JSON.stringify(handbookState)))?.creditTagIds,
    ["foreign_language_required"]);
});
