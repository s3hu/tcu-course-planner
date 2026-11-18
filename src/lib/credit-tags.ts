import registry from "@/data/credit-tags.json";
import type {Category,Course} from "./data";
export type CreditTagId=keyof typeof registry;
export type CreditTag={label:string;kind:"group"|"category"|"requirement"|"program"|"status";color:string};
export const CREDIT_TAGS=registry as Record<CreditTagId,CreditTag>;
export function deriveCreditTags(input:{category:Category;knownCategory:boolean;requiredType?:string;electiveGroup?:string|null;programTags?:string[];creditStatus:Course["creditStatus"]}):CreditTagId[]{
 const tags:CreditTagId[]=[];
 if(input.creditStatus==="excluded"||input.category==="not_counted")tags.push("not_counted");
 else if(!input.knownCategory)tags.push("unverified");
 else if(["foreign_language","physical_education","liberal_arts"].includes(input.category))tags.push("basic",input.category as CreditTagId);
 else tags.push(input.category);
 if(input.requiredType==="required")tags.push("required");
 if(input.requiredType==="elective_required")tags.push(input.electiveGroup==="△1"?"elective_required_1":input.electiveGroup==="△2"?"elective_required_2":"elective_required");
 if(input.requiredType==="elective")tags.push("elective");
 for(const tag of input.programTags??[])if(tag==="DS"||tag==="MS")tags.push(tag);
 if(input.creditStatus==="conditional")tags.push("conditional");
 if(input.creditStatus==="conflict")tags.push("credit_conflict");
 return [...new Set(tags)];
}
export function creditCategoryLabel(course:Pick<Course,"creditTagIds">){return course.creditTagIds.filter(id=>["group","category"].includes(CREDIT_TAGS[id].kind)).map(id=>CREDIT_TAGS[id].label).join(" › ")||course.creditTagIds.filter(id=>CREDIT_TAGS[id].kind==="status").map(id=>CREDIT_TAGS[id].label).join("・")||"区分を確認";}
