import registry from "@/data/credit-tags.json";
import type {Category,Course} from "./data";
export type CreditTagId=keyof typeof registry;
export type CreditTag={label:string;kind:"group"|"category"|"requirement"|"program"|"status";color:string};
export const CREDIT_TAGS=registry as Record<CreditTagId,CreditTag>;
export function deriveCreditTags(input:{category:Category;knownCategory:boolean;includeBasicGroup?:boolean;requiredType?:string;electiveGroup?:string|null;programTags?:string[];creditStatus:Course["creditStatus"]}):CreditTagId[]{
 const tags:CreditTagId[]=[];
 if(input.creditStatus==="excluded"||input.category==="not_counted")tags.push("not_counted");
 else if(!input.knownCategory)tags.push("unverified");
 else if(input.includeBasicGroup!==false&&["foreign_language","physical_education","liberal_arts"].includes(input.category))tags.push("basic",input.category as CreditTagId);
 else tags.push(input.category);
 if(input.requiredType==="required"){
  tags.push("required");
  if(input.category==="foreign_language")tags.push("foreign_language_required");
 }
 if(input.requiredType==="elective_required")tags.push(input.electiveGroup==="△1"?"elective_required_1":input.electiveGroup==="△2"?"elective_required_2":"elective_required");
 if(input.requiredType==="elective")tags.push("elective");
 for(const tag of input.programTags??[])if(tag==="DS"||tag==="MS")tags.push(tag);
 if(input.creditStatus==="conditional")tags.push("conditional");
 if(input.creditStatus==="conflict")tags.push("credit_conflict");
 return [...new Set(tags)];
}
export function creditCategoryLabel(course:Pick<Course,"creditTagIds">){return course.creditTagIds.filter(id=>["group","category"].includes(CREDIT_TAGS[id].kind)).map(id=>CREDIT_TAGS[id].label).join(" › ")||course.creditTagIds.filter(id=>CREDIT_TAGS[id].kind==="status").map(id=>CREDIT_TAGS[id].label).join("・")||"区分を確認";}

export const CREDIT_FILTER_GROUPS = [
 {kind:"group", label:"大区分"},
 {kind:"category", label:"内訳"},
 {kind:"requirement", label:"履修区分"},
] as const;

export function availableCreditFilterTags(courses: readonly Pick<Course,"creditTagIds">[]) {
 const present = new Set(courses.flatMap(course => course.creditTagIds));
 return (Object.keys(CREDIT_TAGS) as CreditTagId[]).filter(id =>
  present.has(id) && CREDIT_FILTER_GROUPS.some(group => group.kind === CREDIT_TAGS[id].kind));
}

export function sanitizeCreditFilterIds(value: unknown, courses: readonly Pick<Course,"creditTagIds">[]): string[] {
 if (!Array.isArray(value)) return [];
 const available = new Set<string>(availableCreditFilterTags(courses));
 return [...new Set(value)].filter((id): id is string => typeof id === "string" && available.has(id));
}

export function matchesCreditTags(course: Pick<Course,"creditTagIds">, selectedIds: readonly string[]) {
 return selectedIds.length === 0 || course.creditTagIds.some(id => selectedIds.includes(id));
}
