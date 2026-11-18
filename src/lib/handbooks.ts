import raw from "@/data/additional-catalog.json";
import {CATEGORIES,offerings,type Category,type Course,type Offering,type Profile} from "./data";
import {deriveCreditTags} from "./credit-tags";
import {overlaps} from "./rules";
import {matchesCampus,type CampusChoice} from "./scheduling";
type RawCourse={course_id:string;title:string;credits:number;category:string;required_type:string;elective_group:string|null;program_tags:string[];course_number:string|null;notes:string|null;scope:string;source:Course["source"];allocation_cells_raw:(string|null)[]};
export type HandbookRules={minimum_total_credits:number;category_minimum_credits:Record<string,number>;foreign_language_required_skill_credits:number;foreign_language_other_minimum_credits:number;data_science_minimum_credits:number;data_science_plus_mathematics_minimum_credits:number;professional_elective_required_groups:{group:string;minimum_credits:number}[];graduation_credit_family_caps:Record<string,number>;registration_cap:{default_credits_per_semester:number;relaxed_credits_per_semester:number;f_GPA_threshold:number;threshold_operator:string;source:{pdf_page:number};current_applicability_not_verified_against_later_notices:boolean};progression:{year_3_minimum_countable_credits:number;graduation_research_1_minimum_countable_credits:number;graduation_research_1_prerequisites:string[];case_research_2_prerequisites:string[];graduation_research_2_prerequisites:string[]};source:{pdf_page:number};degree_detail_source:{pdf_page:number}};
type RawHandbook={year:number;source:{source_id:string;uploaded_filename:string;sha256:string;page_count:number;filename_year_mismatch:boolean};rules:HandbookRules;issues:unknown[];courses:RawCourse[]};
export type HandbookCourse=Course&{curriculumYear:number;catalogScope:"common"|"social_media";electiveGroup:string|null;allocationCellsRaw:(string|null)[]};
export type Handbook={year:number;source:RawHandbook["source"];rules:HandbookRules;courses:HandbookCourse[]};
export type HandbookOffering=Offering&{sourceOfferingId:string;catalogYear:number;syllabusReferenceYear:2025};
export const handbooks:Handbook[]=(raw as unknown as RawHandbook[]).map(h=>({...h,courses:h.courses.map(c=>{
 const category=(c.category in CATEGORIES?c.category:"free_electives") as Category;
 const family=c.title.startsWith("教養特別講義")?"教養特別講義":c.title.startsWith("教養ゼミナール")?"教養ゼミナール":c.title.startsWith("特別講義")?"特別講義":null;
 return {id:c.course_id,name:c.title,credits:c.credits,category,creditTagIds:deriveCreditTags({category,knownCategory:c.category in CATEGORIES,requiredType:c.required_type,electiveGroup:c.elective_group,programTags:c.program_tags,creditStatus:"countable"}),code:c.course_number??"記載なし",year:null,topics:c.program_tags??[],description:"学修要覧の教育課程表に収録された科目です。",prerequisiteIds:[],creditFamily:family,creditStatus:"countable" as const,notes:c.notes??"",source:c.source,requiredType:c.required_type??"未確認",programTags:c.program_tags??[],department:"社会メディア学科",curriculumYear:h.year,catalogScope:c.scope as "common"|"social_media",electiveGroup:c.elective_group,allocationCellsRaw:c.allocation_cells_raw??[]};
})}));
export const SUPPORTED_YEARS=[2022,2023,2024,2025,2026];
export const getHandbook=(year:number)=>handbooks.find(h=>h.year===year);
export function supportsHandbookProfile(p:Profile){return !!getHandbook(p.admissionYear)&&p.faculty==="メディア情報学部"&&p.department==="社会メディア学科";}
export const normalizeCourseTitle=(s:string)=>s.normalize("NFKC").replace(/^\(再\)|^再[・･]?/,"").replace(/\s+/g,"");
// Reuse only the same recorded annual class with explicit cohort coverage and a unique title+credit match.
// The original syllabus remains a clearly labelled 2025-curriculum reference, not a new cohort-specific fetch.
export function mapHandbookOfferings(h:Handbook):HandbookOffering[]{
 const rows:HandbookOffering[]=[];
 for(const o of offerings){
  if(!o.slots.length||!o.meetings.length||o.meetings.some(m=>!m.eligible_enrollment_years||h.year<m.eligible_enrollment_years.from||h.year>m.eligible_enrollment_years.through))continue;
  const matches=h.courses.filter(c=>normalizeCourseTitle(c.name)===normalizeCourseTitle(o.name)&&c.credits===o.credits);
  if(matches.length!==1)continue;
  const c=matches[0];rows.push({...o,id:h.year+":"+o.id,courseId:c.id,sourceOfferingId:o.id,catalogYear:h.year,syllabusReferenceYear:2025,route:{category:c.category,status:"catalog_title_credit_and_explicit_cohort_matched",source:c.source}});
 }
 return rows;
}
const mapped=new Map(handbooks.map(h=>[h.year,mapHandbookOfferings(h)]));
export const handbookOfferings=(year:number)=>mapped.get(year)??[];
export function aggregateHandbook(h:Handbook,ids:string[]){
 const used=new Set(ids),chosen=h.courses.filter(c=>used.has(c.id)).sort((a,b)=>a.id.localeCompare(b.id));
 const counted=new Map<string,number>(),families=new Map<string,number>();let familyExcess=0;
 for(const c of chosen){const cap=c.creditFamily?h.rules.graduation_credit_family_caps[c.creditFamily]:undefined;const amount=cap===undefined?c.credits:Math.max(0,Math.min(c.credits,cap-(families.get(c.creditFamily!)??0)));if(c.creditFamily)families.set(c.creditFamily,(families.get(c.creditFamily)??0)+amount);counted.set(c.id,amount);familyExcess+=c.credits-amount;}
 const categoryRaw=(category:string)=>chosen.filter(c=>c.category===category).reduce((sum,c)=>sum+(counted.get(c.id)??0),0);
 const surplus=Object.entries(h.rules.category_minimum_credits).filter(([id])=>id!=="free_electives").reduce((sum,[id,min])=>sum+Math.max(0,categoryRaw(id)-min),0);
 const breakdown=Object.entries(h.rules.category_minimum_credits).map(([id,required])=>{const amount=categoryRaw(id)+(id==="free_electives"?surplus:0);return {id:id as Category,required,raw:amount,earned:Math.min(amount,required),remaining:Math.max(0,required-amount)};});
 const sum=(test:(c:HandbookCourse)=>boolean)=>chosen.filter(test).reduce((n,c)=>n+(counted.get(c.id)??0),0);
 const requiredLanguage=sum(c=>c.category==="foreign_language"&&c.requiredType==="required");
 const checks=[...h.rules.professional_elective_required_groups.map(g=>({label:"選択必修 "+g.group,earned:sum(c=>c.electiveGroup===g.group),required:g.minimum_credits,unit:"単位"})),{label:"DS科目",earned:sum(c=>c.programTags.includes("DS")),required:h.rules.data_science_minimum_credits,unit:"単位"},{label:"DS・MS合計",earned:sum(c=>c.programTags.includes("DS")||c.programTags.includes("MS")),required:h.rules.data_science_plus_mathematics_minimum_credits,unit:"単位"},{label:"外国語・スキル必修",earned:requiredLanguage,required:h.rules.foreign_language_required_skill_credits,unit:"単位"},{label:"その他の外国語",earned:Math.max(0,categoryRaw("foreign_language")-requiredLanguage),required:h.rules.foreign_language_other_minimum_credits,unit:"単位"},{label:"基礎体育",earned:chosen.filter(c=>c.category==="physical_education"&&c.requiredType==="elective_required"&&(counted.get(c.id)??0)>0).length,required:2,unit:"科目"},{label:"基礎体育の単位",earned:sum(c=>c.category==="physical_education"&&c.requiredType==="elective_required"),required:1,unit:"単位"}];
 return {total:[...counted.values()].reduce((a,b)=>a+b,0),raw:chosen.reduce((n,c)=>n+c.credits,0),breakdown,checks,familyExcess,surplus,missingRequired:h.courses.filter(c=>c.requiredType==="required"&&!used.has(c.id))};
}
export function loadHandbookPlan(year:number,ids:string[],term:Profile["term"]){return handbookOfferings(year).filter(o=>ids.includes(o.id)&&o.quarters.some(q=>(term==="前期"?[1,2]:[3,4]).includes(q))).reduce((sum,o)=>sum+o.credits*(o.quarters.some(q=>q<3)&&o.quarters.some(q=>q>2)?.5:1),0);}
export function handbookOfferingIssues(h:Handbook,o:HandbookOffering,profile:Profile,completed:string[],planned:string[]){
 const issues:string[]=[],c=h.courses.find(c=>c.id===o.courseId);
 if(!c)return ["科目情報がありません"];
 if(o.catalogYear!==h.year||profile.admissionYear!==h.year)issues.push("入学年度が一致しません");
 if(profile.academicYear!==o.academicYear||!o.quarters.some(q=>(profile.term==="前期"?[1,2]:[3,4]).includes(q)))issues.push("対象年度・学期の開講ではありません");
 if(completed.includes(c.id))issues.push("修得済みの科目です");
 const year=profile.academicYear-profile.admissionYear+1;
 const minYears=o.meetings.map(m=>m.assigned_year_raw?.normalize("NFKC").match(/[1-4]/)?.[0]).filter(Boolean).map(Number);
 if(minYears.length&&Math.min(...minYears)>year)issues.push("時間表の配当年次に達していません");
 if(o.meetings.some(m=>m.schedule_type!=="weekly"||!m.weekday||!m.period||!m.quarters?.length))issues.push("全コマの日時が未確認です");
 const others=handbookOfferings(h.year).filter(x=>planned.includes(x.id)&&x.id!==o.id);
 if(others.some(x=>x.courseId===o.courseId))issues.push("同じ科目の別クラスを仮置き済みです");
 for(const x of others.filter(x=>overlaps(x,o)))issues.push("時間が重なる授業："+x.name);
 const completedNames=new Set(h.courses.filter(x=>completed.includes(x.id)).map(x=>x.name));
 const requirements=c.name==="事例研究(2)"?h.rules.progression.case_research_2_prerequisites:c.name==="卒業研究(1)"?h.rules.progression.graduation_research_1_prerequisites:c.name==="卒業研究(2)"?h.rules.progression.graduation_research_2_prerequisites:[];
 for(const name of requirements)if(!completedNames.has(name))issues.push("前提科目が未修得："+name);
 const minimum=c.name==="事例研究(1)"?h.rules.progression.year_3_minimum_countable_credits:c.name==="卒業研究(1)"?h.rules.progression.graduation_research_1_minimum_countable_credits:0;
 if(minimum&&aggregateHandbook(h,completed).total<minimum)issues.push("着手条件の"+minimum+"単位に未達です");
 return [...new Set(issues)];
}
export function handbookReplacement(h:Handbook,o:HandbookOffering,profile:Profile,completed:string[],planned:string[]){
 const conflicts=handbookOfferings(h.year).filter(x=>planned.includes(x.id)&&x.id!==o.id&&(x.courseId===o.courseId||overlaps(x,o)));
 const remaining=planned.filter(id=>!conflicts.some(x=>x.id===id));
 const issues=handbookOfferingIssues(h,o,profile,completed,remaining);
 return {conflicts,remaining,issues,canReplace:conflicts.length>0&&issues.length===0&&!planned.includes(o.id)};
}
export function handbookCandidates(h:Handbook,profile:Profile,quarter:number,day:number,period:number,completed:string[],planned:string[],campus:CampusChoice="yokohama-plus-ondemand"){
 if(!(profile.term==="前期"?[1,2]:[3,4]).includes(quarter))return [];
 return handbookOfferings(h.year).filter(o=>o.academicYear===profile.academicYear&&o.slots.some(s=>s.day===day&&s.period===period&&s.quarters.includes(quarter))&&(planned.includes(o.id)||matchesCampus(o,campus))).map(o=>({offering:o,course:h.courses.find(c=>c.id===o.courseId)!,selected:planned.includes(o.id),issues:handbookOfferingIssues(h,o,profile,completed,planned)})).sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(a.issues.length>0)-Number(b.issues.length>0)||Number(b.course.requiredType==="required")-Number(a.course.requiredType==="required")||a.course.name.localeCompare(b.course.name,"ja"));
}
export type HandbookState={version:1;datasetId:"tcu-handbooks-v1";profile:Profile;completed:string[];planned:string[];campus:CampusChoice};
export function sanitizeHandbookState(value:unknown):HandbookState|null{
 if(!value||typeof value!=="object")return null;const s=value as Partial<HandbookState>;
 if(s.version!==1||s.datasetId!=="tcu-handbooks-v1"||!s.profile||!supportsHandbookProfile(s.profile)||s.profile.academicYear!==2026||!["前期","後期"].includes(s.profile.term)||!Array.isArray(s.completed)||!Array.isArray(s.planned)||!s.completed.every(x=>typeof x==="string")||!s.planned.every(x=>typeof x==="string")||!["yokohama-plus-ondemand","yokohama","setagaya-ondemand","setagaya","all"].includes(s.campus??""))return null;
 const h=getHandbook(s.profile.admissionYear)!;const courseIds=new Set(h.courses.map(c=>c.id)),offeringIds=new Set(handbookOfferings(h.year).map(o=>o.id));
 // Reject cross-curriculum data, rather than silently counting a different year's records.
 if(s.completed.some(id=>!courseIds.has(id))||s.planned.some(id=>!offeringIds.has(id)))return null;
 return {version:1,datasetId:"tcu-handbooks-v1",profile:s.profile,completed:[...new Set(s.completed)],planned:[...new Set(s.planned)],campus:s.campus!};
}
