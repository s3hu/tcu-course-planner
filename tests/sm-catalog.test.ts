import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../src/data/catalog.json";
import { courseById, DEFAULT_STATE, offeringById, offerings } from "../src/lib/data";
import { aggregate, inTarget, projectedSummary, registrationLoad } from "../src/lib/rules";
import { buildSlotIndex } from "../src/lib/slots";

test("the social media catalog has 301 unique 2025 codes and 266 unique 2026 codes", () => {
  const counts = new Map<number, Set<string>>();
  const courseIds = new Set(catalog.courses.map(course => course.course_id));
  const sourceIds = new Set(catalog.sources.map(source => source.source_id));
  for (const offering of catalog.offerings) {
    const codes = counts.get(offering.academicYear) ?? new Set<string>();
    assert.match(offering.lectureCode, /^[a-z0-9]{9}$/);
    assert.ok(!codes.has(offering.lectureCode), offering.id);
    assert.equal(offering.id, `${offering.academicYear}:${offering.lectureCode}`);
    assert.ok(courseIds.has(offering.courseId), offering.id);
    if (offering.academicYear === 2025) {
      assert.ok(offering.source && sourceIds.has(offering.source.source_id), offering.id);
      assert.equal(offering.source.pdf_page, offering.syllabus.source.pdf_page);
      assert.equal(offering.source.source_id, offering.syllabus.source.source_id);
      assert.equal(offering.target_raw, "25 社メ 他");
    }
    codes.add(offering.lectureCode);
    counts.set(offering.academicYear, codes);
  }
  const totals = Object.fromEntries([...counts].map(([year, codes]) => [year, codes.size]));
  assert.deepEqual(totals, { 2025: 301, 2026: 266 });
  assert.deepEqual(totals, catalog.validation.syllabus_offerings_by_year);
  const resultIndices = catalog.offerings.flatMap(offering => offering.source ? [offering.source.result_index] : []);
  assert.deepEqual(resultIndices.sort((a, b) => a - b), Array.from({ length: 301 }, (_, i) => i + 1));
});

test("2025 classes retain their own course identity, teachers, and meeting periods", () => {
  const historical = offeringById.get("2025:yaa052202")!;
  const current = offeringById.get("2026:yaa052202")!;
  assert.equal(courseById.get(historical.courseId)?.name, "基礎体育(1a)");
  assert.equal(courseById.get(current.courseId)?.name, "Test Taking Skills(3a)");

  const lecture = offeringById.get("2025:yaa705101")!;
  assert.equal(lecture.termLabel, "前期前半");
  assert.equal(lecture.teacher, "中村 雅子\n伊澤 理江\n奥村 倫弘");
  assert.deepEqual(lecture.slots, [
    { day: 4, period: 1, quarters: [1] },
    { day: 4, period: 2, quarters: [1] },
  ]);
  const intensive = offeringById.get("2025:sbz007601")!;
  assert.equal(intensive.termLabel, "集中（後期）");
  assert.deepEqual(intensive.slots, []);
  assert.deepEqual(intensive.quarters, [3, 4]);
});

test("uncorroborated historical credits remain pending and teaching credits respect the handbook mark", () => {
  const unknown = catalog.offerings.find(offering => offering.id === "2025:yba053201")!;
  const course = catalog.courses.find(course => course.course_id === unknown.courseId)!;
  assert.equal(course.credits, null);
  assert.equal(course.category, null);
  assert.equal(course.creditStatus, "conditional");
  assert.equal(unknown.route.eligible_credits_per_completion, null);
  assert.ok(catalog.issues.some(issue => issue.status === "要確認" && issue.course_id === course.course_id));

  const teaching = offeringById.get("2025:saz001506")!;
  assert.equal(teaching.credits, 2);
  assert.equal(teaching.route.category, "free_electives");
  const excluded = offeringById.get("2025:sbz006202")!;
  assert.equal(excluded.credits, 2);
  const result = aggregate([unknown.courseId, teaching.courseId, excluded.courseId]);
  assert.equal(result.total, 0);
  assert.equal(result.pending.length, 2);
  assert.equal(result.excluded[0]?.id, excluded.courseId);
});

test("the 2026 Yokohama timetable correction places both ethics classes in fourth period", () => {
  for (const [code, quarter] of [["yba006401", 1], ["ybb006401", 2]] as const) {
    const offering = offeringById.get(`2026:${code}`)!;
    assert.deepEqual(offering.slots, [{ day: 1, period: 4, quarters: [quarter] }]);
    assert.equal(offering.meetings[0].source?.source_id, "yc_timetable_changes_2026_spring");
  }
});

test("2025 plans do not enter 2026 term slots, projected credits, or registration load", () => {
  const state = {
    ...DEFAULT_STATE,
    preferences: { ...DEFAULT_STATE.preferences, campus: "all" as const },
    planned: ["2025:sbz006202"],
  };
  assert.equal(inTarget(offeringById.get(state.planned[0])!, state.profile), false);
  assert.equal(registrationLoad(state), 0);
  assert.deepEqual(projectedSummary(state), aggregate(state.completed));
  for (const quarter of [3, 4]) {
    const indexed = [...buildSlotIndex(state, quarter).values()].flat();
    assert.ok(indexed.length > 0);
    assert.ok(indexed.every(({ offering }) => offering.academicYear === 2026));
  }
  const historical = { ...state, profile: { ...state.profile, academicYear: 2025 } };
  assert.equal(registrationLoad(historical), 2);
  assert.ok(offerings.some(offering => inTarget(offering, historical.profile)));
});

test("graduation and progression rules include the required fields and resolved course references", () => {
  const { rules } = catalog;
  assert.equal(rules.status, "source_grounded_draft_not_official_graduation_certification");
  assert.equal(rules.minimum_enrollment_months, 48);
  assert.equal(rules.minimum_total_credits, 124);
  assert.deepEqual(rules.category_minimum_credits, {
    foreign_language: 8, physical_education: 1, liberal_arts: 10,
    professional_foundation: 33, professional: 60, free_electives: 12,
  });
  assert.equal(rules.required_courses.length, 19);
  assert.deepEqual(rules.elective_required_groups.map(group => group.minimum_credits), [4, 4]);
  assert.equal(rules.foreign_language_rule.required_skill_credits, 4);
  assert.equal(rules.foreign_language_rule.other_foreign_language_minimum, 4);
  assert.equal(rules.physical_education_rule.minimum_number_of_basic_PE_courses, 2);
  assert.equal(rules.physical_education_rule.minimum_credits_from_elective_required_courses, 1);
  assert.equal(rules.data_science_requirement.minimum_DS_credits, 1);
  assert.equal(rules.data_science_requirement.minimum_DS_plus_MS_credits, 4);
  assert.equal(rules.free_electives.minimum_credits, 12);
  assert.deepEqual(rules.credit_caps_for_graduation.map(cap => cap.max_credits), [6, 4, 4]);
  assert.equal(rules.registration_cap.default_credits_per_semester, 24);
  assert.equal(rules.external_credit_recognition_limit.maximum_combined_credits, 60);
  assert.equal(rules.graduation_after_standard_period.eligibility_review_at_each_semester_end, true);

  const { to_year_3, enrollment_limits, ...research } = rules.progression;
  assert.equal(to_year_3.minimum_graduation_countable_credits, 66);
  assert.equal(to_year_3.minimum_enrolled_months_excluding_leave, 24);
  assert.equal(to_year_3.midyear_progression_allowed, false);
  assert.equal(enrollment_limits.maximum_enrolled_months_through_year_2_excluding_leave, 48);
  assert.equal(enrollment_limits.maximum_total_enrolled_months_excluding_leave, 96);
  assert.equal(Object.keys(research).length, 4);
  const referencedIds = [
    ...rules.required_courses,
    ...rules.elective_required_groups.flatMap(group => group.course_ids),
    ...rules.physical_education_rule.course_ids,
    ...rules.data_science_requirement.DS_course_ids,
    ...rules.data_science_requirement.MS_course_ids,
    ...Object.keys(research),
    ...Object.values(research).flatMap(rule => "prerequisite_course_ids" in rule ? rule.prerequisite_course_ids : []),
  ];
  for (const id of referencedIds) assert.ok(courseById.has(id), id);
});
