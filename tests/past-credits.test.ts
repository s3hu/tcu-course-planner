import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { courseById, courses, DEFAULT_STATE, offeringById, offerings, requirement, rules } from "../src/lib/data";
import { aggregateHandbook, getHandbook, handbookDatasetId, sanitizeHandbookState, type HandbookState } from "../src/lib/handbooks";
import { customCreditCategories, matchPastCredits, normalizeCourseName, type CustomCompleted } from "../src/lib/past-credits";

import { aggregate, completedSummary, recordPastCredits, sanitizeState } from "../src/lib/rules";

const profile = { ...DEFAULT_STATE.profile, admissionYear: 2024 };
const handbook = getHandbook(profile.admissionYear)!;
const saved: HandbookState = {
  version: 1, datasetId: handbookDatasetId(profile)!, profile,
  completed: [], planned: [], campus: "all",
};
const catalog = [
  { id: "pbl", name: "SD PBL(1)" },
  { id: "design", name: "情報デザイン基礎" },
  { id: "other-design", name: "情報デザイン基盤" },
];

test("course name normalization folds whitespace, width, case and brackets while keeping the suffix", () => {
  assert.equal(normalizeCourseName(" ＳＤ　ＰＢＬ 【１】 "), "sdpbl1");
  assert.equal(normalizeCourseName("SD\u200b PBL (1)"), normalizeCourseName("sd pbl[１]"));
  assert.notEqual(normalizeCourseName("SD PBL(1)"), normalizeCourseName("SD PBL(2)"));
});

test("title match checks exact rows and ranks spelling variants without choosing them", () => {
  const [matched, review, unmatched] = matchPastCredits("ＳＤ ＰＢＬ（１）\r\n情報デサイン基礎\n他大学の陶芸実習", catalog);
  assert.equal(matched.status === "matched" && matched.course.id, "pbl");
  assert.equal(review.status, "review");
  if (review.status !== "review") assert.fail();
  assert.deepEqual(review.candidates.map(candidate => candidate.course.id), ["design", "other-design"]);
  assert.ok(review.candidates[0].similarity > review.candidates[1].similarity);
  assert.equal(unmatched.status, "unmatched");
});

test("portal and OCR rows drop common headers and columns while preserving source text", () => {
  const input = [
    "科目コード\t科目名\t単位数\t成績",
    "ＳＭ－１１Ａ\tＳＤ ＰＢＬ（１）\t１\tＡ",
    "│ ＳＭ－１１Ａ │ ＳＤ　ＰＢＩ【１】 │ １単位 │ Ａ │",
    "ＳＭ－１１Ａ ＳＤ ＰＢＬ（１） １ Ａ",
    "2024年度\t後期",
    "───",
  ].join("\n");
  const matches = matchPastCredits(input, handbook.courses);
  assert.deepEqual(matches.map(match => match.status), ["matched", "review", "matched"]);
  const review = matches[1];
  assert.equal(review.source, "│ ＳＭ－１１Ａ │ ＳＤ　ＰＢＩ【１】 │ １単位 │ Ａ │");
  assert.equal(review.status === "review" && review.candidates[0].course.name, "SD PBL(1)");
});

test("colliding normalized titles require explicit selection", () => {
  const [match] = matchPastCredits("ＳＤ ＰＢＬ（１）", [
    ...catalog, { id: "other", name: "SD PBL 1" },
  ]);
  assert.equal(match.status, "review");
  assert.deepEqual(match.status === "review" && match.candidates.map(c => c.course.id), ["pbl", "other"]);
});

test("custom credits enter the selected category and total without earning same-name required credits", () => {
  const course = handbook.courses.find(c => c.requiredType === "required" && c.category === "professional_foundation")!;
  const baseline = aggregateHandbook(handbook, []);
  const summary = aggregateHandbook(handbook, [], [
    { name: course.name, credits: 1.5, category: course.category },
    { name: "認定単位", credits: 2, category: "free_electives" },
  ]);
  assert.equal(summary.total, 3.5);
  assert.equal(summary.raw, 3.5);
  assert.equal(summary.breakdown.find(b => b.id === course.category)?.earned, 1.5);
  assert.equal(summary.breakdown.find(b => b.id === "free_electives")?.earned, 2);
  assert.deepEqual(summary.missingRequired, baseline.missingRequired);
  assert.deepEqual(summary.checks, baseline.checks);
});

test("custom category surplus transfers to free electives once", () => {
  const summary = aggregateHandbook(handbook, [], [
    { name: "他学部認定", credits: 12, category: "liberal_arts" },
  ]);
  assert.equal(summary.total, 12);
  assert.equal(summary.surplus, 2);
  assert.equal(summary.breakdown.find(b => b.id === "liberal_arts")?.earned, 10);
  assert.equal(summary.breakdown.find(b => b.id === "free_electives")?.earned, 2);
});

test("custom records survive a version 1 JSON round trip and legacy files still load", () => {
  const customCompleted: CustomCompleted[] = [{ name: "外部実習", credits: 0.5, category: "free_electives" }];
  assert.deepEqual(sanitizeHandbookState(JSON.parse(JSON.stringify({ ...saved, customCompleted }))), { ...saved, customCompleted });
  assert.deepEqual(sanitizeHandbookState(JSON.parse(JSON.stringify(saved))), saved);
  assert.deepEqual(sanitizeHandbookState({ ...saved, datasetId: "tcu-handbooks-v1" }), saved);
  assert.deepEqual(sanitizeHandbookState({ ...saved, customCompleted: [{ ...customCompleted[0], name: "  外部実習  " }] })?.customCompleted, customCompleted);
  assert.ok(!customCreditCategories(handbook.rules.category_minimum_credits).includes("not_counted"));
});

test("invalid custom records are rejected by plan validation", () => {
  const valid = { name: "外部実習", credits: 2, category: "free_electives" };
  for (const customCompleted of [
    null, {}, [null], [{ ...valid, name: "　" }], [{ ...valid, name: "科目\n名" }],
    [{ ...valid, name: "科".repeat(201) }], [{ ...valid, credits: -1 }],
    [{ ...valid, credits: 0 }], [{ ...valid, credits: Infinity }], [{ ...valid, credits: NaN }],
    [{ ...valid, credits: "2" }], [{ ...valid, category: "unknown" }],
    [{ ...valid, category: "constructor" }], [{ ...valid, category: "not_counted" }],
    [{ ...valid, category: "pbl" }],
  ]) assert.equal(sanitizeHandbookState({ ...saved, customCompleted }), null);
});

test("identical custom records are counted once when loading a plan", () => {
  const credit = { name: "認定実習Ａ", credits: 0.5, category: "free_electives" as const };
  const different = { ...credit, credits: 1 };
  const customCompleted = [credit, { ...credit, name: "認定実習A" }, different];
  assert.deepEqual(sanitizeHandbookState({ ...saved, customCompleted })?.customCompleted, [credit, different]);
});

test("the OCR worker loads its assets on request and gives the selected file to local recognition", async () => {
  const script = readFileSync("public/past-credits-ocr.js", "utf8");
  const image = new Blob(["image fixture"], { type: "image/png" });
  const messages: { type: string; text?: string }[] = [];
  const imports: string[] = [];
  let terminated = false;
  const self = {
    onmessage: async (_event: { data: Blob }) => {},
    postMessage: (message: { type: string; text?: string }) => messages.push(message),
  };
  runInNewContext(script, {
    self,
    importScripts: (url: string) => {
      imports.push(url);
      Object.assign(self, {
        Tesseract: {
          async createWorker(lang: string, _oem: number, options: { langPath: string; logger: (progress: unknown) => void }) {
            assert.equal(lang, "jpn");
            assert.match(options.langPath, /jpn@1\.0\.0\/4\.0\.0_best_int$/u);
            return {
              async recognize(file: Blob) {
                assert.equal(file, image);
                options.logger({ status: "recognizing text", progress: 0.5 });
                return { data: { text: "SD PBL(1)" } };
              },
              async terminate() { terminated = true; },
            };
          },
        },
      });
    },
  });
  assert.equal(imports.length, 0);
  await self.onmessage({ data: image });
  assert.equal(imports.length, 1);
  assert.match(imports[0], /tesseract\.js@6\.0\.1\/dist\/tesseract\.min\.js$/u);
  assert.deepEqual(messages.map(message => [message.type, message.text]), [["progress", undefined], ["result", "SD PBL(1)"]]);
  assert.ok(terminated);
});

test("standard matching covers every 2025 offering title and keeps same-name candidates for review", () => {
  const historical = offerings.filter(o => o.academicYear === 2025);
  assert.equal(historical.length, 301);
  for (const opening of historical) {
    const [match] = matchPastCredits(opening.name, courses);
    assert.ok(match.status === "matched", opening.name);
    assert.equal(match.course.id, opening.courseId, opening.name);
  }
  const [variant] = matchPastCredits("基礎 体育（１ａ）", courses);
  assert.ok(variant.status === "matched");
  assert.equal(variant.course.name, "基礎体育(1a)");
  const alternative = { ...variant.course, id: "another-course", code: "ALT01" };
  const [ambiguous] = matchPastCredits(variant.name, [...courses, alternative]);
  assert.ok(ambiguous.status === "review");
  assert.deepEqual(ambiguous.candidates.map(({ course }) => course.id), [variant.course.id, alternative.id]);
});

test("standard custom credits count toward totals and categories without satisfying designated course checks", () => {
  const baseline = aggregate([]);
  const required = courseById.get(requirement.mandatoryIds[0])!;
  const ds = courseById.get(rules.data_science_requirement.DS_course_ids[0])!;
  const physical = courseById.get(rules.physical_education_rule.course_ids[0])!;
  const custom = [required, ds, physical].map(({ name, category }) => ({ name, category, credits: 2 }));
  const summary = completedSummary({ ...DEFAULT_STATE, customCompleted: custom });
  assert.equal(summary.raw, 6);
  assert.equal(summary.total, 6);
  assert.deepEqual(summary.missingRequired, baseline.missingRequired);
  for (const { category } of custom) {
    assert.ok(summary.breakdown.find(row => row.id === category)!.raw >= 2);
  }
  for (const check of summary.checks.filter(row => row.label !== "その他の外国語")) {
    assert.equal(check.earned, 0, check.label);
  }
});

test("standard plan JSON validates and deduplicates custom credits while accepting legacy version 2", () => {
  assert.deepEqual(sanitizeState(JSON.parse(JSON.stringify(DEFAULT_STATE))), DEFAULT_STATE);
  const custom = { name: "Ａ認定実習", credits: 0.5, category: "free_electives" };
  const exported = JSON.stringify({
    ...DEFAULT_STATE, _notice: "export", customCompleted: [
      { ...custom, name: " Ａ認定実習 " }, { ...custom, name: "A認定実習" },
    ],
  });
  assert.deepEqual(sanitizeState(JSON.parse(exported))?.customCompleted, [custom]);
  for (const invalid of [{ ...custom, category: "not_counted" }, { ...custom, credits: 0 }, { ...custom, name: "  " }]) {
    assert.equal(sanitizeState({ ...DEFAULT_STATE, customCompleted: [invalid] }), null);
  }
  assert.equal(sanitizeState({ ...DEFAULT_STATE, customCompleted: {} }), null);
});

test("standard confirmation deduplicates both record types and removes all offerings for a newly completed course", () => {
  const lecture = offeringById.get("2025:yaa705101")!;
  const sameCourse = offerings.filter(o => o.courseId === lecture.courseId).map(o => o.id);
  const otherCourse = offerings.find(o => o.courseId !== lecture.courseId)!;
  const custom: CustomCompleted = { name: "Ａ認定実習", credits: 1, category: "free_electives" };
  const state = { ...DEFAULT_STATE, planned: [...sameCourse, otherCourse.id] };
  const result = recordPastCredits(state, [lecture.courseId, lecture.courseId], [custom, { ...custom, name: "A認定実習" }])!;
  assert.deepEqual(result.state.completed, [lecture.courseId]);
  assert.deepEqual(result.state.planned, [otherCourse.id]);
  assert.deepEqual(result.state.customCompleted, [custom]);
  assert.equal(result.added, 2);
  assert.equal(result.duplicates, 2);
  assert.equal(recordPastCredits(result.state, [lecture.courseId], [custom])?.state, result.state);
});
