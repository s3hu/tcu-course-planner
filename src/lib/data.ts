import catalog from "@/data/catalog.json";
import {deriveCreditTags,type CreditTagId} from "./credit-tags";

export type Category = "foreign_language" | "physical_education" | "liberal_arts" | "professional_foundation" | "professional" | "free_electives" | "not_counted" | "pbl" | "professional_applied";
export type SourceRef = { source_id?: string; source_url?: string; pdf_page?: number; printed_page?: number; retrieved_at?: string };
type RawCourse = { course_id: string; course_number?: string; title: string; credits: number; category?: string; category_path_raw?: string[]; allocation_by_year_raw?: Record<string, string>; allocation_by_semester_hours_raw?: Record<string,string>; required_type?: string; elective_group?: string|null; notes?: string; source: SourceRef; credit_family?: string; program_tags?: string[]; department?: string; graduation_credit_eligible?: boolean };
type Meeting = { weekday: string | null; period: number | null; quarters: number[] | null; schedule_type: string; room_raw?: string | null; class_label?: string | null; assigned_year_raw?: string; campus_code?: string; eligible_enrollment_years?: { from: number; through: number }; source?: SourceRef };
export type Syllabus = { description: string | null; goals: string | null; grading_raw: string | null; prerequisites_raw: string | null; class_flow: string | null; textbooks_raw: string | null; what_to_bring: string | null; reference_books_raw: string | null; assigned_year_raw: string | null; instructors_raw: string | null; updated_at_raw: string | null; source: SourceRef; grading_percentage_mentions?: { context: string; percent: number; matched_text: string }[]; exam_weight_percent: number | null };
export type CreditRoute = { category?: string | null; status: string; eligible_credits_per_completion?: number | null; conditions?: string[]; source?: SourceRef | SourceRef[]; credit_family?: string };
type RawOffering = { id: string; courseId: string; lectureCode: string; title: string; academicYear: number; credits: number; termLabel: string; route: CreditRoute; meetings: Meeting[]; syllabus: Syllabus; registrationNote?: string | null; creditProcedure?: unknown };
export type Slot = { day: number; period: number; quarters: number[] };
export type Course = { id: string; code: string; name: string; credits: number; category: Category; creditTagIds:CreditTagId[]; year: number | null; topics: string[]; description: string; prerequisiteIds: string[]; creditFamily: string | null; creditStatus: "countable" | "conditional" | "conflict" | "excluded"; notes: string; source: SourceRef; requiredType: string; programTags: string[]; department: string | null; allocationSlots?: {year:number;term:"前期"|"後期";primary:boolean}[] };
export type Offering = { id: string; courseId: string; lectureCode: string; name: string; academicYear: number; credits: number; term: "前期" | "後期"; termLabel: string; quarters: number[]; slots: Slot[]; meetings: Meeting[]; campus: string; room: string; teacher: string; assessment: null; assessmentText: string; sourceId: string; syllabus: Syllabus; route: CreditRoute; registrationNote: string | null; creditProcedure: unknown };
export type Profile = { admissionYear: number; faculty: string; department: string; academicYear: number; term: "前期" | "後期" };
export type Preferences = { avoidDays: number[]; dayMode: "strict" | "soft"; assessment: "any" | "report" | "exam"; interests: string[]; avoidPeriods: number[]; creditTagIds: string[]; campus?: import("./scheduling").CampusChoice; reportOnly?: boolean };
export type PlannerState = { version: 2; datasetId: string; profile: Profile; completed: string[]; planned: string[]; preferences: Preferences };
export const DATASET_ID = "tcu-sm-2025-v2";
export const DAYS = ["月", "火", "水", "木", "金", "土"];
export const TIMES = ["", "", "", "", ""];
export const CATEGORIES: Record<Category, { label: string; short: string; color: string }> = {
  foreign_language: { label: "外国語科目", short: "外国語", color: "#3154b8" },
  physical_education: { label: "体育科目", short: "体育", color: "#4c7852" },
  liberal_arts: { label: "教養科目", short: "教養", color: "#9a702c" },
  professional_foundation: { label: "専門基礎科目", short: "専門基礎", color: "#3a746b" },
  professional_applied: { label: "専門応用科目", short: "専門応用", color: "#865d88" },
  professional: { label: "専門科目", short: "専門", color: "#79619b" },
  free_electives: { label: "自由選択", short: "自由選択", color: "#7c7464" },
  pbl: { label: "PBL科目", short: "PBL", color: "#99704a" },
  not_counted: { label: "卒業非算入", short: "非算入", color: "#7d8176" },
};
export const rules = catalog.rules;
export const scope = catalog.scope;
export const dataIssues = catalog.issues;
export const sources = catalog.sources;
export const source = { id: DATASET_ID, title: "提供JSON 社会メディア学科2025年度入学 v2.0.0", kind: "資料に基づく提供データ・一部未確認", academicYear: scope.syllabus_academic_year, updatedAt: catalog.generatedAt.slice(0, 10), retrievedAt: catalog.generatedAt.slice(0, 10), reviewer: "提供JSONの作成者（全件の再監査は未実施）", status: "draft", url: "https://websrv.tcu.ac.jp/tcu_web_v3/top.do" };
export const requirement = { id: DATASET_ID, admissionYear: scope.enrollment_year, faculty: scope.faculty, department: scope.department, title: "2025年度入学 社会メディア学科", version: "提供JSON v2.0.0", sourceId: "handbook_2025", total: rules.minimum_total_credits, categories: Object.entries(rules.category_minimum_credits).map(([id, required]) => ({ id: id as Category, required })), mandatoryIds: rules.required_courses };
const rawCourses = catalog.courses as unknown as RawCourse[];
const rawOfferings = catalog.offerings as unknown as RawOffering[];
const inferFamily = (c: RawCourse) => c.credit_family ?? (c.title.startsWith("教養特別講義") ? "general_special_lecture" : c.title.startsWith("教養ゼミナール") ? "liberal_arts_seminar" : c.title.startsWith("特別講義") ? "special_lecture" : null);
export const courses: Course[] = rawCourses.map(c => {
  const related = rawOfferings.filter(o => o.courseId === c.course_id);
  const route = related[0]?.route;
  const conflict = related.some(o => o.route.status === "credit_value_conflict_requires_confirmation" || o.credits !== c.credits);
  const conditional = c.course_id.includes("-external-") || c.category === "teacher_training" || route?.status.includes("if_registration");
  const excluded = c.graduation_credit_eligible === false || route?.status === "not_counted_toward_graduation";
  const category = c.category && c.category in CATEGORIES ? c.category as Category : route?.category && route.category in CATEGORIES ? route.category as Category : excluded ? "not_counted" : "free_electives";
  const allocation = Object.entries(c.allocation_by_year_raw ?? {}).filter(([, v]) => v.trim()).map(([k]) => Number(k));
  const syllabusYears = related.map(o => o.syllabus.assigned_year_raw?.match(/[1-4１-４]/)?.[0]?.normalize("NFKC")).filter(Boolean).map(Number);
  const years = allocation.length ? allocation : syllabusYears;
  const progression = (rules.progression as Record<string, { prerequisite_course_ids?: string[] }>)[c.course_id];
  return { id: c.course_id, code: c.course_number ?? "記載なし", name: c.title, credits: c.credits, category, creditTagIds:deriveCreditTags({category,knownCategory:!!(c.category&&c.category in CATEGORIES||route?.category&&route.category in CATEGORIES),requiredType:c.required_type,electiveGroup:c.elective_group,programTags:c.program_tags,creditStatus:excluded?"excluded":conflict?"conflict":conditional?"conditional":"countable"}), year: years.length ? Math.min(...years) : null,
    topics: ["メディア", "デザイン", "データ", "プログラミング", "社会", "心理", "英語"].filter(t => c.title.includes(t)),
    description: related[0]?.syllabus.description ?? "このデータにはシラバス本文が収録されていません。",
    prerequisiteIds: progression?.prerequisite_course_ids ?? [], creditFamily: inferFamily(c), creditStatus: excluded ? "excluded" : conflict ? "conflict" : conditional ? "conditional" : "countable",
    allocationSlots: Object.entries(c.allocation_by_semester_hours_raw??{}).filter(([,v])=>v.trim()).map(([key,v])=>({year:Number(key.split(":")[0]),term:key.endsWith(":first")?"前期" as const:"後期" as const,primary:/[0-9]/.test(v.normalize("NFKC").replace(/\([^)]*\)/g,""))})),
    notes: c.notes ?? "", source: c.source, requiredType: c.required_type ?? "未確認", programTags: c.program_tags ?? [], department: c.department ?? null,
  };
});
export const courseById = new Map(courses.map(c => [c.id, c]));
const campusNames = new Map(catalog.campuses.map(c => [c.code, c.name]));
export const termQuarters = (term: string): number[] => term.includes("前期前") ? [1] : term.includes("前期後") ? [2] : term.includes("後期前") ? [3] : term.includes("後期後") ? [4] : term.includes("前期") ? [1, 2] : term.includes("後期") ? [3, 4] : [];
export const offerings: Offering[] = rawOfferings.map(o => {
  const slots = o.meetings.filter(m => m.schedule_type === "weekly" && m.weekday && DAYS.includes(m.weekday) && m.period && m.period >= 1 && m.period <= 5 && m.quarters?.length).map(m => ({ day: DAYS.indexOf(m.weekday!), period: m.period!, quarters: m.quarters! }));
  const quarters = [...new Set(o.meetings.flatMap(m => m.quarters ?? []))];
  return { id: o.id, courseId: o.courseId, lectureCode: o.lectureCode, name: o.title, academicYear: o.academicYear, credits: o.credits,
    term: o.termLabel.includes("後期") ? "後期" : "前期", termLabel: o.termLabel, quarters: quarters.length ? quarters : termQuarters(o.termLabel), slots, meetings: o.meetings,
    campus: [...new Set(o.meetings.map(m => campusNames.get(m.campus_code ?? "") ?? "未確認"))].join("・") || "未確認",
    room: [...new Set(o.meetings.map(m => m.room_raw).filter(Boolean))].join("・") || "未確認", teacher: o.syllabus.instructors_raw || "記載なし",
    assessment: null, assessmentText: o.syllabus.grading_raw || "記載なし", sourceId: "syllabus_search_2026", syllabus: o.syllabus, route: o.route,
    registrationNote: o.registrationNote ?? null, creditProcedure: o.creditProcedure ?? null,
  };
});
export const offeringById = new Map(offerings.map(o => [o.id, o]));
export const DEFAULT_STATE: PlannerState = { version: 2, datasetId: DATASET_ID, profile: { admissionYear: 2025, faculty: scope.faculty, department: scope.department, academicYear: 2026, term: "後期" }, completed: [], planned: [], preferences: { avoidDays: [], dayMode: "soft", assessment: "any", interests: [], avoidPeriods: [], creditTagIds: [], campus: "yokohama-plus-ondemand", reportOnly: false } };
export const Q_LABELS = ["", "前期前半", "前期後半", "後期前半", "後期後半"];
export function officialUrl(value?: string | null) { try { const u = new URL(value ?? ""); return u.protocol === "https:" && (u.hostname === "tcu.ac.jp" || u.hostname.endsWith(".tcu.ac.jp")) ? u.href : null; } catch { return null; } }
export function sourceLabel(s: SourceRef) { return (s.source_id === "handbook_2025" ? "2025年度 学修要覧" : s.source_id === "uploaded_timetable" ? "2026年度 時間表" : s.source_id ?? "シラバス") + (s.pdf_page ? " PDF " + s.pdf_page + "ページ" : "") + (s.printed_page ? "（冊子 " + s.printed_page + "ページ）" : ""); }
