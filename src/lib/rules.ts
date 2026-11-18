import { CATEGORIES, DATASET_ID, courses, courseById, offeringById, requirement, rules, type Category, type Course, type Offering, type PlannerState, type Profile } from "./data";

export function applicable(p: Profile) { return p.admissionYear === requirement.admissionYear && p.department === requirement.department && p.faculty === requirement.faculty; }
export function inTarget(o: Offering, p: Profile) { return o.academicYear === p.academicYear && o.quarters.some(q => (p.term === "前期" ? [1, 2] : [3, 4]).includes(q)); }
export function aggregate(ids: string[], catalog: Course[] = courses) {
  const unique = new Set(ids);
  const chosen = catalog.filter(c => unique.has(c.id)).sort((a,b) => a.id.localeCompare(b.id));
  const counted = new Map<string, number>();
  const familyUsed = new Map<string, number>();
  let familyExcess = 0;
  for (const c of chosen) {
    if (c.creditStatus !== "countable") continue;
    const cap = rules.credit_caps_for_graduation.find(r => r.credit_family === c.creditFamily)?.max_credits;
    const credits = cap === undefined ? c.credits : Math.max(0, Math.min(c.credits, cap - (familyUsed.get(c.creditFamily!) ?? 0)));
    if (c.creditFamily) familyUsed.set(c.creditFamily, (familyUsed.get(c.creditFamily) ?? 0) + credits);
    familyExcess += c.credits - credits; counted.set(c.id, credits);
  }
  const categoryRaw = (id: Category) => chosen.filter(c => c.category === id).reduce((sum,c) => sum + (counted.get(c.id) ?? 0),0);
  const surplus = requirement.categories.filter(r => r.id !== "free_electives").reduce((sum,r) => sum + Math.max(0,categoryRaw(r.id)-r.required),0);
  const breakdown = requirement.categories.map(r => { const raw = categoryRaw(r.id) + (r.id === "free_electives" ? surplus : 0); const earned = Math.min(raw,r.required); return { ...r,raw,earned,remaining:Math.max(0,r.required-earned),excluded:0 }; });
  const sumIds = (list: string[]) => list.reduce((sum,id) => sum + (counted.get(id) ?? 0),0);
  const ds = rules.data_science_requirement, pe = rules.physical_education_rule;
  const languageSkillIds = requirement.mandatoryIds.filter(id => courseById.get(id)?.category === "foreign_language");
  const checks = [
    ...rules.elective_required_groups.map(g => ({ label:"選択必修 " + g.group,earned:sumIds(g.course_ids),required:g.minimum_credits,unit:"単位" })),
    { label:"DS科目",earned:sumIds(ds.DS_course_ids),required:ds.minimum_DS_credits,unit:"単位" },
    { label:"DS・MS科目合計",earned:sumIds([...ds.DS_course_ids,...ds.MS_course_ids]),required:ds.minimum_DS_plus_MS_credits,unit:"単位" },
    { label:"外国語・スキル必修",earned:sumIds(languageSkillIds),required:rules.foreign_language_rule.required_skill_credits,unit:"単位" },
    { label:"その他の外国語",earned:Math.max(0,categoryRaw("foreign_language")-sumIds(languageSkillIds)),required:rules.foreign_language_rule.other_foreign_language_minimum,unit:"単位" },
    { label:"基礎体育",earned:pe.course_ids.filter(id => counted.has(id)).length,required:pe.minimum_number_of_basic_PE_courses,unit:"科目" },
    { label:"基礎体育の単位",earned:sumIds(pe.course_ids),required:pe.minimum_credits_from_elective_required_courses,unit:"単位" },
  ];
  return { breakdown,total:[...counted.values()].reduce((a,b)=>a+b,0),raw:chosen.reduce((sum,c)=>sum+c.credits,0),missingRequired:requirement.mandatoryIds.filter(id=>!counted.has(id)),pending:chosen.filter(c=>c.creditStatus==="conditional"||c.creditStatus==="conflict"),excluded:chosen.filter(c=>c.creditStatus==="excluded"),familyExcess,surplus,checks };
}
export function overlaps(a: Offering,b: Offering) { return a.academicYear===b.academicYear && a.slots.some(s=>b.slots.some(t=>s.day===t.day&&s.period===t.period&&s.quarters.some(q=>t.quarters.includes(q)))); }
export function evaluate(o: Offering,state: PlannerState): {status:"eligible"|"blocked"|"unknown";reasons:string[]} {
  const c=courseById.get(o.courseId); if(!c)return {status:"unknown",reasons:["科目情報が未確認です"]};
  const blocked:string[]=[], unknown:string[]=[];
  if(!inTarget(o,state.profile))blocked.push("対象年度・学期の開講ではありません");
  if(state.completed.includes(c.id))blocked.push("修得済みの科目です");
  const assignedYears=o.syllabus.assigned_year_raw?.normalize("NFKC").match(/[1-4]/g)?.map(Number)??[];
  const minYear=Math.max(c.year??0,assignedYears.length?Math.min(...assignedYears):0)||null;
  if(minYear!==null&&minYear>state.profile.academicYear-state.profile.admissionYear+1)blocked.push("配当年次は"+minYear+"年次からです");
  if(o.meetings.some(m=>m.eligible_enrollment_years&&(state.profile.admissionYear<m.eligible_enrollment_years.from||state.profile.admissionYear>m.eligible_enrollment_years.through)))blocked.push("入学年度の対象範囲に合わない時間表の行があります");
  if(c.prerequisiteIds.some(id=>!state.completed.includes(id)))blocked.push("前提科目が未修得："+c.prerequisiteIds.filter(id=>!state.completed.includes(id)).map(id=>courseById.get(id)?.name??id).join("・"));
  const progression=(rules.progression as Record<string,{minimum_graduation_countable_credits?:number;requires_year_3_progression?:boolean;minimum_enrolled_months_excluding_leave?:number}>)[c.id];
  if(progression?.minimum_graduation_countable_credits&&aggregate(state.completed).total<progression.minimum_graduation_countable_credits)blocked.push("着手条件の"+progression.minimum_graduation_countable_credits+"単位に未達です");
  if(progression?.requires_year_3_progression||progression?.minimum_enrolled_months_excluding_leave)unknown.push("進級・在学期間の確認が必要です");
  if(state.preferences.dayMode==="strict"&&o.slots.some(s=>state.preferences.avoidDays.includes(s.day)))blocked.push("必ず空ける曜日と重なります");
  if(o.slots.some(s=>state.preferences.avoidPeriods.includes(s.period)))blocked.push("履修しない時限と重なります");
  const other=state.planned.map(id=>offeringById.get(id)).filter((x):x is Offering=>!!x&&x.id!==o.id);
  if(other.some(x=>x.courseId===c.id&&x.academicYear===o.academicYear))blocked.push("同一科目の別クラスを計画済みです");
  if(other.some(x=>overlaps(o,x)))blocked.push("同じ曜日・時限・学期前半／後半に予定があります");
  if(blocked.length)return {status:"blocked",reasons:blocked};
  if(!applicable(state.profile))unknown.push("この入学年度・所属の要件は未対応です");
  if(c.creditStatus==="conditional")unknown.push("卒業算入は他学科・教職等の個別確認が必要です");
  if(c.creditStatus==="conflict")unknown.push("科目表とシラバスの単位数が不一致です");
  if(c.creditStatus==="excluded")unknown.push("卒業要件には算入しない科目です");
  if(!o.slots.length||o.meetings.some(m=>m.schedule_type!=="weekly"))unknown.push("集中講義・認定科目等の日時は個別確認が必要です");
  unknown.push("履修条件・クラス指定・定員・最新訂正は個別確認が必要です");
  return {status:"unknown",reasons:unknown};
}

export type CreditSummary = ReturnType<typeof aggregate>;
const mandatoryIds = new Set<string>(requirement.mandatoryIds);
export function currentAcademicYear(profile:Profile) { return profile.academicYear-profile.admissionYear+1; }
export function isCurrentRequired(course:Course,profile:Profile) {
  if(!mandatoryIds.has(course.id))return false;
  const year=currentAcademicYear(profile);
  if(course.allocationSlots?.length)return course.allocationSlots.some(s=>s.year===year&&s.term===profile.term&&s.primary);
  return course.year===year;
}
export function projectedSummary(state:PlannerState) {
  return aggregate([...state.completed,...state.planned.map(id=>offeringById.get(id)).filter((o):o is Offering=>!!o&&inTarget(o,state.profile)).map(o=>o.courseId)]);
}
export function goalMeasures(summary:CreditSummary) {
  return {
    checks:summary.checks.reduce((sum,c)=>sum+(c.required>0?Math.min(c.earned,c.required)/c.required:0),0),
    categories:summary.breakdown.reduce((sum,c)=>sum+c.earned,0),
    total:summary.total,
  };
}
export type CoursePriority = {tier:number;label:string;score:number;goalGain:number;categoryGain:number;countedGain:number;preferenceScore:number;reasons:string[]};
export function priorityFor(o:Offering,state:PlannerState,summary=projectedSummary(state),nextSummary?:CreditSummary):CoursePriority {
  const c=courseById.get(o.courseId)!;
  if(!applicable(state.profile))return {tier:7,label:"要件未対応",score:0,goalGain:0,categoryGain:0,countedGain:0,preferenceScore:0,reasons:["この入学年度・所属の要件は未対応です"]};
  const next=nextSummary??aggregate([...state.completed,...state.planned.map(id=>offeringById.get(id)).filter((x):x is Offering=>!!x&&inTarget(x,state.profile)).map(x=>x.courseId),c.id]);
  const before=goalMeasures(summary),after=goalMeasures(next);
  const goalGain=Math.max(0,after.checks-before.checks),categoryGain=Math.max(0,after.categories-before.categories),countedGain=Math.max(0,after.total-before.total);
  const improved=summary.checks.filter((x,i)=>Math.min(next.checks[i].earned,x.required)>Math.min(x.earned,x.required));
  let tier=6,label="その他の算入対象",reasons:string[]=[];
  if(mandatoryIds.has(c.id)&&!state.completed.includes(c.id)){
    if(isCurrentRequired(c,state.profile)){tier=1;label="今期・当該年次の必修";reasons.push(currentAcademicYear(state.profile)+"年次"+state.profile.term+"の未修得必修を先に確保");}
    else{tier=2;label="未修得の必修";reasons.push("未修得の必修科目（再履修候補を含む）");}
  }else if(goalGain>0){tier=3;label="選択必修・DS等の不足";reasons.push(...improved.map(x=>x.label+"の不足を補う"));}
  else if(categoryGain>0){tier=4;label="単位区分の不足";reasons.push(CATEGORIES[c.category].short+"等の不足を補う候補");}
  let preferenceScore=0;
  const interested=state.preferences.interests.filter(t=>(o.name+" "+(o.syllabus.description??"")).includes(t));
  if(interested.length){preferenceScore+=Math.min(3,interested.length)*4;reasons.push("本文に「"+interested[0]+"」の記載");}
  if(state.preferences.avoidDays.length&&o.slots.length){const avoided=o.slots.some(s=>state.preferences.avoidDays.includes(s.day));preferenceScore+=avoided?-8:4;if(avoided)reasons.push("できれば空けたい曜日に開講");}
  const needle=state.preferences.assessment==="report"?"レポート":state.preferences.assessment==="exam"?"試験":null;
  if(needle&&o.assessmentText.includes(needle))preferenceScore+=1;
  if(tier===6&&preferenceScore>0){tier=5;label="興味・希望に合う選択科目";}
  const score=(7-tier)*100000+Math.min(9999,Math.round(goalGain*1000+categoryGain*100+countedGain*10))+preferenceScore;
  return {tier,label,score,goalGain,categoryGain,countedGain,preferenceScore,reasons:reasons.length?reasons:["対象学期の開講情報"]};
}
export function rank(o:Offering,state:PlannerState,_summary?:CreditSummary) {
  const result=evaluate(o,state),priority=priorityFor(o,state);
  return {...result,...priority,priority,warnings:result.reasons};
}

export function planIssues(state:PlannerState) { return state.planned.flatMap(id=>{const o=offeringById.get(id);return o?evaluate(o,state).reasons.map(message=>({id,message})):[{id,message:"開講情報が見つかりません"}];}); }
export function registrationLoad(state:PlannerState) { return state.planned.map(id=>offeringById.get(id)).filter((o):o is Offering=>!!o&&inTarget(o,state.profile)).reduce((sum,o)=>sum+o.credits*(o.quarters.some(q=>q<=2)&&o.quarters.some(q=>q>=3)?rules.registration_cap.yearlong_course_semester_multiplier:1),0); }
export function sanitizeState(value:unknown):PlannerState|null {
  if(!value||typeof value!=="object")return null; const s=value as Partial<PlannerState>;
  if(s.version!==2||s.datasetId!==DATASET_ID||!s.profile||!s.preferences||!Array.isArray(s.completed)||!Array.isArray(s.planned))return null;
  const p=s.profile,f=s.preferences;
  if(!Number.isInteger(p.admissionYear)||p.admissionYear<2000||p.admissionYear>2100||!Number.isInteger(p.academicYear)||p.academicYear<p.admissionYear||p.academicYear>2100||typeof p.faculty!=="string"||typeof p.department!=="string"||!["前期","後期"].includes(p.term))return null;
  if(!["strict","soft"].includes(f.dayMode)||!["any","report","exam"].includes(f.assessment)||!Array.isArray(f.avoidDays)||!f.avoidDays.every(d=>Number.isInteger(d)&&d>=0&&d<6)||!Array.isArray(f.avoidPeriods)||!f.avoidPeriods.every(p=>Number.isInteger(p)&&p>=1&&p<=5)||!Array.isArray(f.interests)||!f.interests.every(t=>typeof t==="string"&&t.length<100))return null;
  if(f.campus!==undefined&&!["yokohama-plus-ondemand","yokohama","setagaya-ondemand","setagaya","all"].includes(f.campus))return null;
  if(f.reportOnly!==undefined&&typeof f.reportOnly!=="boolean")return null;
  return {version:2,datasetId:DATASET_ID,profile:p,preferences:{...f,campus:f.campus??"yokohama-plus-ondemand",reportOnly:f.reportOnly??false},completed:[...new Set(s.completed)].filter(id=>courseById.has(id)),planned:[...new Set(s.planned)].filter(id=>offeringById.has(id))};
}
