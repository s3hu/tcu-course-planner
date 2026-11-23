import raw from "@/data/additional-catalog.json";
import informationSystemsRaw from "@/data/information-systems-catalog.json";
import environmentRaw from "@/data/environment-catalog.json";
import designDataScienceRaw from "@/data/design-data-science-catalog.json";
import {CATEGORIES,courseById,offerings,type Category,type Course,type Offering,type Profile} from "./data";
import {deriveCreditTags,sanitizeCreditFilterIds} from "./credit-tags";
import {overlaps} from "./rules";
import {planRequiredAdditions} from "./required-additions";
import {matchesTermHalves,sanitizeTermHalves,type TermHalf} from "./term-halves";
import {matchesCampus,type CampusChoice} from "./scheduling";
import {customCreditCategories,sanitizeCustomCredits,type CustomCompleted} from "./past-credits";
const SOCIAL_MEDIA = "社会メディア学科";
export const INFORMATION_SYSTEMS = "情報システム学科";
export const MEDIA_FACULTY = "メディア情報学部";
export const ENVIRONMENT_FACULTY = "環境学部";
export const DESIGN_FACULTY = "デザイン・データ科学部";
export const ENVIRONMENTAL_CREATION = "環境創生学科";
export const ENVIRONMENTAL_MANAGEMENT = "環境経営システム学科";
export const DESIGN_DATA_SCIENCE = "デザイン・データ科学科";
export const HANDBOOK_FACULTIES = [MEDIA_FACULTY, ENVIRONMENT_FACULTY, DESIGN_FACULTY] as const;
const departmentsByFaculty = {
 [MEDIA_FACULTY]: [SOCIAL_MEDIA, INFORMATION_SYSTEMS],
 [ENVIRONMENT_FACULTY]: [ENVIRONMENTAL_CREATION, ENVIRONMENTAL_MANAGEMENT],
 [DESIGN_FACULTY]: [DESIGN_DATA_SCIENCE],
} as const;
type HandbookFaculty = typeof HANDBOOK_FACULTIES[number];
type HandbookDepartment = typeof departmentsByFaculty[HandbookFaculty][number];
const departmentScopes = {
 [SOCIAL_MEDIA]: "social_media",
 [INFORMATION_SYSTEMS]: "information_systems",
 [ENVIRONMENTAL_CREATION]: "environmental_creation",
 [ENVIRONMENTAL_MANAGEMENT]: "environmental_management",
 [DESIGN_DATA_SCIENCE]: "design_data_science",
} as const;
const facultySlugs = {
 [MEDIA_FACULTY]: "media",
 [ENVIRONMENT_FACULTY]: "environment",
 [DESIGN_FACULTY]: "design",
} as const;
type HandbookDatasetId = `tcu-handbook-${number}-${typeof facultySlugs[HandbookFaculty]}-${typeof departmentScopes[HandbookDepartment]}-v1`;
const LEGACY_HANDBOOK_DATASET_ID = "tcu-handbooks-v1";
type CatalogScope = "common" | typeof departmentScopes[HandbookDepartment];
export function handbookDepartments(faculty: string): readonly HandbookDepartment[] {
 const knownFaculty = HANDBOOK_FACULTIES.find(name => name === faculty);
 return knownFaculty ? departmentsByFaculty[knownFaculty] : [];
}
type RuleSource = {pdf_page:number};

type RawCourse={course_id:string;title:string;credits:number;category:string;required_type:string;elective_group:string|null;program_tags:string[];course_number:string|null;notes:string|null;scope:CatalogScope;source:Course["source"];allocation_cells_raw:(string|null)[]};
export type HandbookRules = {
 minimum_total_credits: number;
 category_minimum_credits: Record<string,number>;
 foreign_language_required_skill_credits: number;
 foreign_language_other_minimum_credits: number;
 data_science_minimum_credits: number;
 data_science_plus_mathematics_minimum_credits: number;
 professional_elective_required_groups: {group:string;minimum_credits:number}[];
 elective_required_categories?: {category:Category;group:string;minimum_credits:number}[];
 study_abroad?: { policy: "required_in_principle" | "faculty_guidance"; description: string; sources: RuleSource[] };
 graduation_credit_family_caps: Record<string,number>;
 registration_cap: {
  default_credits_per_semester: number;
  relaxed_credits_per_semester: number;
  f_GPA_threshold: number;
  threshold_operator: string;
  source: RuleSource;
  current_applicability_not_verified_against_later_notices: boolean;
 };
 progression: {
  year_3_minimum_countable_credits: number;
  year_3_minimum_enrolled_months_excluding_leave: number;
  case_research_1_title?: string;
  graduation_research_1_title?: string;
  graduation_research_1_minimum_countable_credits: number;
  graduation_research_1_minimum_enrolled_months_excluding_leave: number;
  graduation_research_1_prerequisites: string[];
  case_research_2_prerequisites: string[];
  graduation_research_2_prerequisites: string[];
  sources: RuleSource[];
 };
 source: RuleSource;
 degree_detail_source: RuleSource;
};
type RawHandbook={year:number;source:{source_id:string;uploaded_filename:string;sha256:string;page_count:number;filename_year_mismatch:boolean};rules:HandbookRules;issues:unknown[];courses:RawCourse[]};
export type HandbookCourse=Course&{department:HandbookDepartment;curriculumYear:number;catalogScope:CatalogScope;electiveGroup:string|null;allocationCellsRaw:(string|null)[]};
type FacultyHandbook = RawHandbook & {department:HandbookDepartment};
export type Handbook={year:number;faculty:HandbookFaculty;issues:RawHandbook["issues"];department:HandbookDepartment;source:RawHandbook["source"];rules:HandbookRules;courses:HandbookCourse[]};
export type HandbookOffering=Offering&{sourceOfferingId:string;catalogYear:number;catalogFaculty:HandbookFaculty;catalogDepartment:HandbookDepartment;syllabusReferenceYear:2025};
function loadHandbook(h: RawHandbook, department: HandbookDepartment, courses = h.courses, faculty:HandbookFaculty = MEDIA_FACULTY): Handbook {
 return {...h,faculty,department,courses:courses.map(c=>{
  const category=(c.category in CATEGORIES?c.category:"free_electives") as Category;
  const family=c.title.startsWith("教養特別講義")?"教養特別講義":c.title.startsWith("教養ゼミナール")?"教養ゼミナール":c.title.startsWith("特別講義")?"特別講義":null;
  const creditStatus = category === "not_counted" ? "excluded" : "countable";
  return {id:c.course_id,name:c.title,credits:c.credits,category,creditTagIds:deriveCreditTags({category,knownCategory:c.category in CATEGORIES,includeBasicGroup:faculty!==DESIGN_FACULTY,requiredType:c.required_type,electiveGroup:c.elective_group,programTags:c.program_tags,creditStatus}),code:c.course_number??"記載なし",year:null,topics:c.program_tags??[],description:"学修要覧の教育課程表に収録された科目です。",prerequisiteIds:[],creditFamily:family,creditStatus,notes:c.notes??"",source:c.source,requiredType:c.required_type??"未確認",programTags:c.program_tags??[],department,curriculumYear:h.year,catalogScope:c.scope,electiveGroup:c.elective_group,allocationCellsRaw:c.allocation_cells_raw??[]};
 })};
}

const socialMediaRaw = raw as unknown as RawHandbook[];
export const handbooks = socialMediaRaw.map(h => loadHandbook(h, SOCIAL_MEDIA));
const informationSystemsHandbooks = (informationSystemsRaw as unknown as RawHandbook[]).map(h => {
 const sharedCourses = socialMediaRaw.find(shared => shared.year === h.year)?.courses.filter(c => c.scope === "common") ?? [];
 return loadHandbook(h, INFORMATION_SYSTEMS, [...sharedCourses, ...h.courses]);
});
const environmentHandbooks = (environmentRaw as unknown as FacultyHandbook[]).map(h => loadHandbook(h, h.department, h.courses, ENVIRONMENT_FACULTY));
const designHandbooks = (designDataScienceRaw as unknown as RawHandbook[]).map(h => loadHandbook(h, DESIGN_DATA_SCIENCE, h.courses, DESIGN_FACULTY));
const curricula = [...handbooks, ...informationSystemsHandbooks, ...environmentHandbooks, ...designHandbooks];

export const SUPPORTED_YEARS=[2022,2023,2024,2025,2026];
export const getHandbook = (year: number, department: string = SOCIAL_MEDIA, faculty: string = MEDIA_FACULTY) =>
 curricula.find(h => h.year === year && h.department === department && h.faculty === faculty);
export function handbookDatasetId({admissionYear, faculty, department}: Pick<Profile, "admissionYear" | "faculty" | "department">): HandbookDatasetId | null {
 if (typeof faculty !== "string" || typeof department !== "string") return null;
 const handbook = getHandbook(admissionYear, department, faculty);
 if (!handbook) return null;
 return `tcu-handbook-${handbook.year}-${facultySlugs[handbook.faculty]}-${departmentScopes[handbook.department]}-v1`;
}
export function supportsHandbookProfile(p: Profile) {
 return !!getHandbook(p.admissionYear, p.department, p.faculty);
}
export const normalizeCourseTitle=(s:string)=>s.normalize("NFKC").replace(/^\(再\)|^再[・･]?/,"").replace(/\s+/g,"");
// Reuse only the same recorded annual class with explicit cohort coverage and a unique title+credit match.
// The original syllabus remains a clearly labelled 2025-curriculum reference, not a new cohort-specific fetch.
export function mapHandbookOfferings(h:Handbook):HandbookOffering[]{
 const coursesByTitle = new Map<string, HandbookCourse[]>();
 for (const course of h.courses) {
  const title = normalizeCourseTitle(course.name);
  const sameTitle = coursesByTitle.get(title) ?? [];
  sameTitle.push(course);
  coursesByTitle.set(title, sameTitle);
 }
 const rows:HandbookOffering[]=[];
 for(const o of offerings){
  if(!o.slots.length||!o.meetings.length||o.meetings.some(m=>!m.eligible_enrollment_years||h.year<m.eligible_enrollment_years.from||h.year>m.eligible_enrollment_years.through))continue;
  const matches=coursesByTitle.get(normalizeCourseTitle(o.name))?.filter(c=>c.credits===o.credits)??[];
  if(matches.length!==1)continue;
  const c=matches[0];
  // A matching title and cohort do not override a class confined to its own department.
  if (h.department !== SOCIAL_MEDIA && courseById.get(o.courseId)?.notes.includes("他学科履修不可")) continue;
  const id = h.department === SOCIAL_MEDIA ? h.year + ":" + o.id : h.year + ":" + departmentScopes[h.department] + ":" + o.id;
  rows.push({...o,id,courseId:c.id,sourceOfferingId:o.id,catalogYear:h.year,catalogFaculty:h.faculty,catalogDepartment:h.department,syllabusReferenceYear:2025,route:{category:c.category,status:"catalog_title_credit_and_explicit_cohort_matched",source:c.source}});
 }
 return rows;
}
const mapped = new Map(curricula.map(h => [h, mapHandbookOfferings(h)]));
export function handbookOfferings(year: number, department: string = SOCIAL_MEDIA, faculty: string = MEDIA_FACULTY) {
 const handbook = getHandbook(year, department, faculty);
 return handbook ? mapped.get(handbook) ?? [] : [];
}
export function aggregateHandbook(h:Handbook,ids:string[],customCompleted:readonly CustomCompleted[]=[]){
 const used=new Set(ids),chosen=h.courses.filter(c=>used.has(c.id)).sort((a,b)=>a.id.localeCompare(b.id));
 const counted=new Map<string,number>(),families=new Map<string,number>();let familyExcess=0;
 for(const c of chosen){if(c.creditStatus==="excluded")continue;const cap=c.creditFamily?h.rules.graduation_credit_family_caps[c.creditFamily]:undefined;const amount=cap===undefined?c.credits:Math.max(0,Math.min(c.credits,cap-(families.get(c.creditFamily!)??0)));if(c.creditFamily)families.set(c.creditFamily,(families.get(c.creditFamily)??0)+amount);counted.set(c.id,amount);familyExcess+=c.credits-amount;}
 const customTotal=customCompleted.reduce((sum,c)=>sum+c.credits,0);
 const categoryRaw=(category:string)=>chosen.filter(c=>c.category===category).reduce((sum,c)=>sum+(counted.get(c.id)??0),0)
  +customCompleted.filter(c=>c.category===category).reduce((sum,c)=>sum+c.credits,0);
 const surplus=Object.entries(h.rules.category_minimum_credits).filter(([id])=>id!=="free_electives").reduce((sum,[id,min])=>sum+Math.max(0,categoryRaw(id)-min),0);
 const breakdown=Object.entries(h.rules.category_minimum_credits).map(([id,required])=>{const amount=categoryRaw(id)+(id==="free_electives"?surplus:0);return {id:id as Category,required,raw:amount,earned:Math.min(amount,required),remaining:Math.max(0,required-amount)};});
 const sum=(test:(c:HandbookCourse)=>boolean)=>chosen.filter(test).reduce((n,c)=>n+(counted.get(c.id)??0),0);
 const requiredLanguage=sum(c=>c.category==="foreign_language"&&c.requiredType==="required");
 const electiveGroups = [
  ...h.rules.professional_elective_required_groups.map(g => ({...g, category:"professional" as Category})),
  ...h.rules.elective_required_categories ?? [],
 ];
 const checks = electiveGroups.map(g => ({
  label:h.rules.elective_required_categories ? CATEGORIES[g.category].short+" 選択必修 "+g.group : "選択必修 "+g.group,
  earned:sum(c => c.category===g.category && c.electiveGroup===g.group),
  required:g.minimum_credits,
  unit:"単位",
 }));
 if(h.faculty===MEDIA_FACULTY||h.rules.data_science_minimum_credits)checks.push({label:"DS科目",earned:sum(c=>c.programTags.includes("DS")),required:h.rules.data_science_minimum_credits,unit:"単位"});
 checks.push({label:"DS・MS合計",earned:sum(c=>c.programTags.includes("DS")||c.programTags.includes("MS")),required:h.rules.data_science_plus_mathematics_minimum_credits,unit:"単位"});
 checks.push({label:h.faculty===DESIGN_FACULTY?"英語 必修":"外国語・スキル必修",earned:requiredLanguage,required:h.rules.foreign_language_required_skill_credits,unit:"単位"});
 if(h.faculty===MEDIA_FACULTY||h.rules.foreign_language_other_minimum_credits)checks.push({label:"その他の外国語",earned:Math.max(0,categoryRaw("foreign_language")-requiredLanguage),required:h.rules.foreign_language_other_minimum_credits,unit:"単位"});
 if(h.rules.category_minimum_credits.physical_education){
  const sports=(c:HandbookCourse)=>c.category==="physical_education"&&c.requiredType==="elective_required";
  checks.push({label:"基礎体育",earned:chosen.filter(c=>sports(c)&&(counted.get(c.id)??0)>0).length,required:2,unit:"科目"});
  checks.push({label:"基礎体育の単位",earned:sum(sports),required:1,unit:"単位"});
 }
 return {total:[...counted.values()].reduce((a,b)=>a+b,customTotal),raw:chosen.reduce((n,c)=>n+c.credits,customTotal),breakdown,checks,familyExcess,surplus,missingRequired:h.courses.filter(c=>c.requiredType==="required"&&!used.has(c.id))};
}
export function loadHandbookPlan(year:number,ids:string[],term:Profile["term"],department:string=SOCIAL_MEDIA,faculty:string=MEDIA_FACULTY){return handbookOfferings(year,department,faculty).filter(o=>ids.includes(o.id)&&o.quarters.some(q=>(term==="前期"?[1,2]:[3,4]).includes(q))).reduce((sum,o)=>sum+o.credits*(o.quarters.some(q=>q<3)&&o.quarters.some(q=>q>2)?.5:1),0);}
export function handbookOfferingIssues(h:Handbook,o:HandbookOffering,profile:Profile,completed:string[],planned:string[],customCompleted:readonly CustomCompleted[]=[]){
 const issues:string[]=[],c=h.courses.find(c=>c.id===o.courseId);
 if(!c)return ["科目情報がありません"];
 if(o.catalogYear!==h.year||profile.admissionYear!==h.year)issues.push("入学年度が一致しません");
 if(o.catalogFaculty!==h.faculty||profile.faculty!==h.faculty)issues.push("学部が一致しません");
 if(o.catalogDepartment!==h.department||profile.department!==h.department)issues.push("学科が一致しません");
 if(profile.academicYear!==o.academicYear||!o.quarters.some(q=>(profile.term==="前期"?[1,2]:[3,4]).includes(q)))issues.push("対象年度・学期の開講ではありません");
 if(completed.includes(c.id))issues.push("修得済みの科目です");
 const year=profile.academicYear-profile.admissionYear+1;
 const minYears=o.meetings.map(m=>m.assigned_year_raw?.normalize("NFKC").match(/[1-4]/)?.[0]).filter(Boolean).map(Number);
 if(minYears.length&&Math.min(...minYears)>year)issues.push("時間表の配当年次に達していません");
 if(o.meetings.some(m=>m.schedule_type!=="weekly"||!m.weekday||!m.period||!m.quarters?.length))issues.push("全コマの日時が未確認です");
 const others=handbookOfferings(h.year,h.department,h.faculty).filter(x=>planned.includes(x.id)&&x.id!==o.id);
 if(others.some(x=>x.courseId===o.courseId))issues.push("同じ科目の別クラスを仮置き済みです");
 for(const x of others.filter(x=>overlaps(x,o)))issues.push("時間が重なる授業："+x.name);
 const completedNames=new Set(h.courses.filter(x=>completed.includes(x.id)).map(x=>x.name));
 const researchTitle=h.rules.progression.graduation_research_1_title??"卒業研究(1)";
 const requirements=c.name==="事例研究(2)"?h.rules.progression.case_research_2_prerequisites:c.name===researchTitle?h.rules.progression.graduation_research_1_prerequisites:c.name==="卒業研究(2)"?h.rules.progression.graduation_research_2_prerequisites:[];
 for(const name of requirements)if(!completedNames.has(name))issues.push("前提科目が未修得："+name);
 const minimum=c.name===(h.rules.progression.case_research_1_title??"事例研究(1)")?h.rules.progression.year_3_minimum_countable_credits:c.name===researchTitle?h.rules.progression.graduation_research_1_minimum_countable_credits:0;
 if(minimum&&aggregateHandbook(h,completed,customCompleted).total<minimum)issues.push("着手条件の"+minimum+"単位に未達です");
 return [...new Set(issues)];
}
export function handbookReplacement(h:Handbook,o:HandbookOffering,profile:Profile,completed:string[],planned:string[],customCompleted:readonly CustomCompleted[]=[]){
 const conflicts=handbookOfferings(h.year,h.department,h.faculty).filter(x=>planned.includes(x.id)&&x.id!==o.id&&(x.courseId===o.courseId||overlaps(x,o)));
 const remaining=planned.filter(id=>!conflicts.some(x=>x.id===id));
 const issues=handbookOfferingIssues(h,o,profile,completed,remaining,customCompleted);
 return {conflicts,remaining,issues,canReplace:conflicts.length>0&&issues.length===0&&!planned.includes(o.id)};
}
export function addHandbookRequiredOfferings(h: Handbook, profile: Profile, completed: string[], planned: string[], campus: CampusChoice, halves: TermHalf[], customCompleted: readonly CustomCompleted[] = []) {
  return planRequiredAdditions({
    required: aggregateHandbook(h, completed).missingRequired,
    offerings: handbookOfferings(h.year, h.department, h.faculty),
    profile, completed, planned, halves,
    issuesFor: (o, ids) => [
      ...handbookOfferingIssues(h, o, profile, completed, ids, customCompleted),
      ...(matchesCampus(o, campus) ? [] : ["キャンパス・受講形式の条件に合いません"]),
    ],
  });
}
export function handbookCandidates(h:Handbook,profile:Profile,quarter:number,day:number,period:number,completed:string[],planned:string[],campus:CampusChoice="yokohama-plus-ondemand",halves:TermHalf[]=[],customCompleted:readonly CustomCompleted[]=[]){
 if(!(profile.term==="前期"?[1,2]:[3,4]).includes(quarter))return [];
 return handbookOfferings(h.year,h.department,h.faculty).filter(o=>o.academicYear===profile.academicYear&&o.slots.some(s=>s.day===day&&s.period===period&&s.quarters.includes(quarter))&&(planned.includes(o.id)||(matchesTermHalves(o,profile.term,halves)&&matchesCampus(o,campus)))).map(o=>({offering:o,course:h.courses.find(c=>c.id===o.courseId)!,selected:planned.includes(o.id),issues:handbookOfferingIssues(h,o,profile,completed,planned,customCompleted)})).sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(a.issues.length>0)-Number(b.issues.length>0)||Number(b.course.requiredType==="required")-Number(a.course.requiredType==="required")||a.course.name.localeCompare(b.course.name,"ja"));
}
export type HandbookState={version:1;datasetId:HandbookDatasetId;profile:Profile;completed:string[];planned:string[];campus:CampusChoice;customCompleted?:CustomCompleted[];creditTagIds?:string[];halves?:TermHalf[]};
export function sanitizeHandbookState(value:unknown):HandbookState|null{
 if(!value||typeof value!=="object")return null;const s=value as Partial<Omit<HandbookState, "datasetId">> & {datasetId?: unknown};
 if(s.version!==1||!s.profile||s.profile.academicYear!==2026||!["前期","後期"].includes(s.profile.term)||!Array.isArray(s.completed)||!Array.isArray(s.planned)||!s.completed.every(x=>typeof x==="string")||!s.planned.every(x=>typeof x==="string")||!["yokohama-plus-ondemand","yokohama","setagaya-ondemand","setagaya","all"].includes(s.campus??""))return null;
 const datasetId = handbookDatasetId(s.profile);
 if (!datasetId || (s.datasetId !== datasetId && s.datasetId !== LEGACY_HANDBOOK_DATASET_ID)) return null;
 const h=getHandbook(s.profile.admissionYear,s.profile.department,s.profile.faculty)!;const courseIds=new Set(h.courses.map(c=>c.id)),offeringIds=new Set(handbookOfferings(h.year,h.department,h.faculty).map(o=>o.id));
 // Reject cross-curriculum data, rather than silently counting a different year's records.
 if(s.completed.some(id=>!courseIds.has(id))||s.planned.some(id=>!offeringIds.has(id)))return null;
 const customCompleted = s.customCompleted === undefined ? undefined
  : sanitizeCustomCredits(s.customCompleted, customCreditCategories(h.rules.category_minimum_credits));
 if (customCompleted === null) return null;
 return {version:1,datasetId,profile:s.profile,completed:[...new Set(s.completed)],planned:[...new Set(s.planned)],campus:s.campus!,
  ...(s.customCompleted===undefined?{}:{customCompleted}),
  ...(s.halves===undefined?{}:{halves:sanitizeTermHalves(s.halves)}),
  ...(s.creditTagIds===undefined?{}:{creditTagIds:sanitizeCreditFilterIds(s.creditTagIds,h.courses)})};
}
