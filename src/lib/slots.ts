import {courseById,offerings,offeringById,type Offering,type PlannerState} from "./data";
import {evaluate,inTarget,priorityFor,projectedSummary,type CoursePriority} from "./rules";
import {matchesCreditTags} from "./credit-tags";
import {matchesPreferences} from "./scheduling";
export type SlotKey={day:number;period:number;quarter:number};
export type SlotCandidate={offering:Offering;selected:boolean;evaluation:ReturnType<typeof evaluate>;priority:CoursePriority};
export const slotId=(day:number,period:number)=>day+":"+period;
export function buildSlotIndex(state:PlannerState,quarter:number){
 const result=new Map<string,SlotCandidate[]>(),summary=projectedSummary(state),selected=new Set(state.planned);
 if(!(state.profile.term==="前期"?[1,2]:[3,4]).includes(quarter))return result;
 for(const o of offerings){
  if(!inTarget(o,state.profile)||!o.quarters.includes(quarter)||(!selected.has(o.id)&&!matchesPreferences(o,state)))continue;
  const row={offering:o,selected:selected.has(o.id),evaluation:evaluate(o,state),priority:priorityFor(o,state,summary)};
  for(const key of new Set(o.slots.filter(s=>s.quarters.includes(quarter)).map(s=>slotId(s.day,s.period)))){const rows=result.get(key)??[];rows.push(row);result.set(key,rows);}
 }
 for(const rows of result.values())rows.sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(a.evaluation.status==="blocked")-Number(b.evaluation.status==="blocked")||b.priority.score-a.priority.score||a.offering.name.localeCompare(b.offering.name,"ja")||a.offering.id.localeCompare(b.offering.id));
 return result;
}
export function candidatesAt(state:PlannerState,slot:SlotKey){
 const rows=buildSlotIndex(state,slot.quarter).get(slotId(slot.day,slot.period))??[];
 return rows.filter(r=>!r.selected||matchesCreditTags(courseById.get(r.offering.courseId)!,state.preferences.creditTagIds));
}
export function selectedAt(state:PlannerState,slot:SlotKey){return state.planned.map(id=>offeringById.get(id)).filter((o):o is Offering=>!!o&&inTarget(o,state.profile)&&o.slots.some(s=>s.day===slot.day&&s.period===slot.period&&s.quarters.includes(slot.quarter)));}
