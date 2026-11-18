import reviewed from "@/data/reviewed-assessments.json";
import { CATEGORIES, courseById, offerings, offeringById, requirement, DAYS, rules, type Offering, type PlannerState } from "./data";
import { aggregate, applicable, evaluate, inTarget, overlaps, registrationLoad, currentAcademicYear, isCurrentRequired, priorityFor, goalMeasures } from "./rules";

import {selectRequiredSeeds,type RequiredGroup} from "./required-solver";

export type CampusChoice = "yokohama-plus-ondemand" | "yokohama" | "setagaya-ondemand" | "setagaya" | "all";
export const CAMPUS_CHOICES: { value: CampusChoice; label: string }[] = [
  { value: "yokohama-plus-ondemand", label: "横浜 ＋ 世田谷オンデマンド" },
  { value: "yokohama", label: "横浜キャンパス" },
  { value: "setagaya-ondemand", label: "世田谷オンデマンドのみ" },
  { value: "setagaya", label: "世田谷キャンパス（形式は要確認）" },
  { value: "all", label: "キャンパスを問わない" },
];
// The supplied JSON has no explicit on-demand delivery data. Only reviewed source metadata may establish it.
export function delivery(o: Offering): "on-demand" | "unknown" {
  const reviewedMode = (o as Offering & { reviewedDelivery?: { mode: string; sourceUrl: string } }).reviewedDelivery;
  return reviewedMode?.mode === "on-demand" && !!reviewedMode.sourceUrl ? "on-demand" : "unknown";
}
export function reportOnly(o: Offering) { return (reviewed as Record<string, { reportOnly: boolean }>)[o.id]?.reportOnly === true; }
export function matchesCampus(o: Offering, choice: CampusChoice = "yokohama-plus-ondemand") {
  if (choice === "all") return true;
  const codes = [...new Set(o.meetings.map(m => m.campus_code))];
  const yokohama = codes.length > 0 && codes.every(c => c === "YC");
  const setagaya = codes.length > 0 && codes.every(c => c === "SC");
  if (choice === "yokohama") return yokohama;
  if (choice === "setagaya") return setagaya;
  if (choice === "setagaya-ondemand") return setagaya && delivery(o) === "on-demand";
  return yokohama || (setagaya && delivery(o) === "on-demand");
}
export function matchesPreferences(o: Offering, state: PlannerState) {
  return matchesCampus(o, state.preferences.campus) && (!state.preferences.reportOnly || requirement.mandatoryIds.includes(o.courseId) || reportOnly(o));
}

export type DraftOptions = {targetCredits:number;preserveExisting:boolean};
export type RequiredAudit = {courseId:string;name:string;year:number|null;current:boolean;status:"completed"|"future"|"other_term"|"unavailable"|"scheduled"|"ready"|"blocked";reasons:string[]};
export type ScheduleDraft = {id:string;planned:string[];credits:number;title:string;summary:string;campusDays:number;warnings:string[];required:RequiredAudit[];currentRequiredTotal:number;currentRequiredScheduled:number;missingRequired:RequiredAudit[]};
export type ScheduleResult = {drafts:ScheduleDraft[];messages:string[];required:RequiredAudit[]};
const requiredIds=new Set<string>(requirement.mandatoryIds);
export function knownWeeklySchedule(o:Offering){
 return o.slots.length>0&&o.meetings.length>0&&o.meetings.every(m=>m.schedule_type==="weekly"&&!!m.weekday&&DAYS.includes(m.weekday)&&Number.isInteger(m.period)&&m.period!>=1&&m.period!<=5&&!!m.quarters?.length&&m.quarters.every(q=>[1,2,3,4].includes(q)));
}
function autoExclusions(o:Offering,state:PlannerState){
 const reasons:string[]=[];
 const evaluation=evaluate(o,state);
 if(evaluation.status==="blocked")reasons.push(...evaluation.reasons);
 if(!knownWeeklySchedule(o))reasons.push("すべての開講日時を確認できないため自動作成の対象外");
 if(courseById.get(o.courseId)?.creditStatus!=="countable")reasons.push("卒業算入が未確認、または算入対象外");
 if(!matchesCampus(o,state.preferences.campus))reasons.push("キャンパス・受講形式の条件に合いません");
 if(state.preferences.reportOnly&&!requiredIds.has(o.courseId)&&!reportOnly(o))reasons.push("選択科目のレポート100%条件に合いません");
 const clashes=state.planned.map(id=>offeringById.get(id)).filter((x):x is Offering=>!!x&&x.id!==o.id&&overlaps(o,x));
 if(clashes.length)reasons.push("時間が重なる科目："+[...new Set(clashes.map(x=>x.name))].join("・"));
 return [...new Set(reasons)];
}
export function auditRequired(state:PlannerState,planned=state.planned,target?:number):RequiredAudit[]{
 const selected={...state,planned},year=currentAcademicYear(state.profile);
 return requirement.mandatoryIds.map(courseId=>{
   const c=courseById.get(courseId)!,current=isCurrentRequired(c,state.profile);
   const common={courseId,name:c.name,year:c.year,current};
   if(state.completed.includes(courseId))return {...common,status:"completed" as const,reasons:["修得済み"]};
   if(c.year!==null&&c.year>year)return {...common,status:"future" as const,reasons:[c.year+"年次の必修。今の学年の自動作成には含めません"]};
   const options=offerings.filter(o=>o.courseId===courseId&&inTarget(o,state.profile));
   if(!options.length){
     const nominal=c.allocationSlots?.some(s=>s.year<=year&&s.term===state.profile.term&&s.primary);
     if(!current&&!nominal)return {...common,status:"other_term" as const,reasons:["今期の開講データはありません。別学期の必修として確認"]};
     return {...common,status:"unavailable" as const,reasons:["今期の必修に該当しますが、対応する開講データがありません"]};
   }
   const chosen=options.find(o=>planned.includes(o.id));
   if(chosen){const exclusions=autoExclusions(chosen,selected);return {...common,status:exclusions.length?"blocked" as const:"scheduled" as const,reasons:exclusions.length?exclusions:["仮時間割に含まれています"]};}
   const alternatives=options.map(o=>({o,reasons:autoExclusions(o,selected)}));
   const usable=alternatives.filter(x=>!x.reasons.length);
   if(usable.length&&target!==undefined&&usable.every(x=>registrationLoad({...selected,planned:[...planned,x.o.id]})>target))return {...common,status:"blocked" as const,reasons:["目標"+target+"単位の上限に収まりません"]};
   if(usable.length)return {...common,status:"ready" as const,reasons:[current?"今期の必修として先に確保します":"未修得の必修として選択科目より先に検討します"]};
   return {...common,status:"blocked" as const,reasons:[...new Set(alternatives.flatMap(x=>x.reasons))]};
 });
}
type Node={ids:string[];load:number;styleScore:number;metrics:ReturnType<typeof goalMeasures>};
const difference=(a:number,b:number)=>Math.abs(a-b)<1e-8?0:a-b;
function compareNodes(a:Node,b:Node){return difference(b.metrics.checks,a.metrics.checks)||difference(b.metrics.categories,a.metrics.categories)||difference(b.load,a.load)||difference(b.styleScore,a.styleScore)||a.ids.join("|").localeCompare(b.ids.join("|"));}
export function generateSchedules(state:PlannerState,options:DraftOptions):ScheduleResult{
 const initialAudit=auditRequired(state,options.preserveExisting?state.planned:[]);
 const fail=(messages:string[],required=initialAudit):ScheduleResult=>({drafts:[],messages,required});
 if(!applicable(state.profile))return fail(["この入学年度・所属に対応するデータがありません。"]);
 if(!offerings.some(o=>o.academicYear===state.profile.academicYear))return fail(["対象年度の開講データがありません。収録されている2026年度を選んでください。"]);
 const target=Math.max(.5,Math.min(rules.registration_cap.default_credits_per_semester,Number.isFinite(options.targetCredits)?options.targetCredits:20));
 const locked=options.preserveExisting?[...new Set(state.planned)]:[],fixedState={...state,planned:locked};
 if(locked.some(id=>!offeringById.has(id)))return fail(["固定する予定に、開講情報が存在しない授業があります。"]);
 const lockedOfferings=locked.map(id=>offeringById.get(id)!);
 const invalid=lockedOfferings.map(o=>({o,reasons:autoExclusions(o,fixedState)})).filter(x=>x.reasons.length);
 if(invalid.length)return fail(["固定中の予定を確認するか「今の仮時間割を固定」を外してください。",...invalid.map(x=>x.o.name+"："+x.reasons.join("／"))]);
 const load=(o:Offering)=>registrationLoad({...state,planned:[o.id]});
 const lockedLoad=registrationLoad(fixedState);
 if(lockedLoad>target)return fail(["固定済みの予定が目標単位数を超えています。目標を増やすか、固定を外してください。"]);
 const audit=auditRequired(state,locked,target);
 const blockedCore=audit.filter(a=>a.current&&!["completed","scheduled","ready"].includes(a.status));
 if(blockedCore.length)return fail(["今期・当該年次の必修を含む案が作れません。必修を外した案は作成していません。",...blockedCore.map(a=>a.name+"："+a.reasons.join("／"))],audit);
 const lockedCourses=new Set(lockedOfferings.map(o=>o.courseId));
 const groups:RequiredGroup[]=audit.filter(a=>["ready","blocked"].includes(a.status)&&!lockedCourses.has(a.courseId)).map(a=>({courseId:a.courseId,current:a.current,choices:offerings.filter(o=>o.courseId===a.courseId&&inTarget(o,state.profile)&&!autoExclusions(o,fixedState).length).map(offering=>({offering,load:load(offering)}))}));
 const minimumCore=groups.filter(g=>g.current).reduce((sum,g)=>sum+Math.min(...g.choices.map(x=>x.load)),lockedLoad);
 if(minimumCore>target)return fail(["今期必修と固定済みの予定だけで最低"+minimumCore+"単位です。目標"+target+"単位には収まりません。目標を増やすか、固定を見直してください。"],audit);
 const mandatory=selectRequiredSeeds(groups,lockedOfferings,lockedLoad,target);
 if(!mandatory.seeds.length){
   const conflicts=groups.filter(g=>g.current).flatMap((g,i,arr)=>arr.slice(i+1).filter(h=>g.choices.every(a=>h.choices.every(b=>overlaps(a.offering,b.offering)))).map(h=>courseById.get(g.courseId)!.name+" と "+courseById.get(h.courseId)!.name+" の開講時間が重なります"));
   return fail([mandatory.exhausted?"必修の組み合わせ探索が上限に達しました。固定条件を減らして再試行してください。":"今期の必修を同時に含められません。時間重複・固定予定・目標単位数を確認してください。",...conflicts],audit);
 }
 // Optional courses are filled only after complete current-year mandatory seeds have been found.
 const initial=offerings.filter(o=>!requiredIds.has(o.courseId)&&!lockedCourses.has(o.courseId)&&inTarget(o,state.profile)&&!autoExclusions(o,fixedState).length);
 const cache=new Map<string,ReturnType<typeof aggregate>>();
 const summaryFor=(ids:string[])=>{
   const selectedIds=[...new Set([...state.completed,...ids.map(id=>offeringById.get(id)!.courseId)])].sort(),key=selectedIds.join("|");
   let result=cache.get(key);
   if(!result){result=aggregate(selectedIds,selectedIds.map(id=>courseById.get(id)).filter((c):c is NonNullable<typeof c>=>!!c));cache.set(key,result);}
   return result;
 };
 const nodeFor=(ids:string[],nodeLoad:number,styleScore=0):Node=>({ids,load:nodeLoad,styleScore,metrics:goalMeasures(summaryFor(ids))});
 const styles=[
   {title:"必修・不足要件を優先",days:0,morning:0,seed:0},
   {title:"必修を確保して登校日を調整",days:8,morning:0,seed:1},
   {title:"必修を確保して朝を控えめに",days:0,morning:8,seed:2},
   {title:"必修を確保した別の組み合わせ",days:3,morning:2,seed:3},
 ];
 const drafts=new Map<string,ScheduleDraft>();
 for(const style of styles){
   let beam=mandatory.seeds.map(s=>nodeFor(s.ids,s.load)).sort(compareNodes).slice(0,24);
   const best:Node[]=[...beam];
   for(let depth=0;depth<48;depth++){
     const next:Node[]=[];
     for(const node of beam){
       if(node.load>=target)continue;
       const selected=node.ids.map(id=>offeringById.get(id)!),usedDays=new Set(selected.flatMap(o=>o.slots.map(s=>s.day)));
       const nodeState={...state,planned:node.ids},summary=summaryFor(node.ids);
       const choices=initial.filter(o=>node.load+load(o)<=target&&!selected.some(p=>p.courseId===o.courseId||overlaps(p,o))).map(o=>{
         const projected=summaryFor([...node.ids,o.id]);
         const priority=priorityFor(o,nodeState,summary,projected);
         const extraDays=new Set(o.slots.map(s=>s.day).filter(d=>!usedDays.has(d))).size;
         const styleGain=priority.preferenceScore-extraDays*style.days-(o.slots.some(s=>s.period===1)?style.morning:0);
         const variety=[...o.id].reduce((sum,ch)=>sum+ch.charCodeAt(0),style.seed*13)%11/1000;
         return {o,priority,styleGain,variety};
       }).filter(x=>x.priority.countedGain>0).sort((a,b)=>b.priority.score-a.priority.score||b.styleGain-a.styleGain||b.variety-a.variety||a.o.id.localeCompare(b.o.id));
       const usedSections=new Map<string,number>();let added=0;
       for(const {o,styleGain} of choices){
         const count=usedSections.get(o.courseId)??0;if(count>=2)continue;usedSections.set(o.courseId,count+1);
         next.push(nodeFor([...node.ids,o.id],node.load+load(o),node.styleScore+styleGain));
         if(++added>=10)break;
       }
     }
     if(!next.length)break;
     const unique=new Map<string,Node>();
     for(const node of next.sort(compareNodes)){const key=[...node.ids].sort().join("|");if(!unique.has(key))unique.set(key,node);if(unique.size>=24)break;}
     beam=[...unique.values()];best.push(...beam);
   }
   let kept=0;
   for(const node of best.sort(compareNodes)){
     if(!node.ids.length)continue;
     const key=[...node.ids].sort().join("|");if(drafts.has(key))continue;
     const verified=auditRequired(state,node.ids,target),current=verified.filter(a=>a.current&&a.status!=="completed");
     if(current.some(a=>a.status!=="scheduled"))continue;
     const missing=verified.filter(a=>!["completed","scheduled","future","other_term"].includes(a.status));
     const os=node.ids.map(id=>offeringById.get(id)!),categories=[...new Set(os.map(o=>CATEGORIES[courseById.get(o.courseId)!.category].short))];
     drafts.set(key,{id:"draft-"+drafts.size,planned:node.ids,credits:node.load,title:style.title,summary:categories.join("・")+"を含む仮案",campusDays:new Set(os.flatMap(o=>o.slots.map(s=>s.day))).size,required:verified,currentRequiredTotal:current.length,currentRequiredScheduled:current.filter(a=>a.status==="scheduled").length,missingRequired:missing,warnings:[
       "個別の履修許可・クラス指定・最新訂正は要確認",
       ...(missing.length?["未修得必修に未解決の"+missing.length+"科目があります。下の必修チェックを確認してください"]:[]),
       ...(node.load<target?["条件内では目標"+target+"単位に届いていません"]:[]),
     ]});
     if(++kept>=2)break;
   }
 }
 const messages=[
   "今期・当該年次の必修を先に確保し、未修得必修→選択必修・DS等→不足区分→希望条件の順で検討しています。",
   "参考案の有限探索です。全組み合わせの網羅や、卒業・履修許可の判定ではありません。",
   ...(!state.completed.length?["修得科目が未入力です。過年度の必修も未修得として扱っています。修得済みを登録して作り直してください。"]:[]),
   ...(mandatory.exhausted?["再履修必修の探索が上限に達したため、その最大充足数は確定していません。"]:[]),
   ...(state.preferences.reportOnly?["レポート100%条件は選択科目だけに適用します。必修をこの条件で除外しません。"]:[]),
 ];
 if(!drafts.size)messages.push(state.preferences.campus==="setagaya-ondemand"?"確認済みの世田谷オンデマンド開講データがありません。":"この条件で作成できる時間割がありません。");
 return {drafts:[...drafts.values()].slice(0,8),messages,required:audit};
}
