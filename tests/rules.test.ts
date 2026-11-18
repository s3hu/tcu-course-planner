import test from "node:test";
import assert from "node:assert/strict";
import { DATASET_ID, DEFAULT_STATE, courses, courseById, offerings, requirement, rules, type Course } from "../src/lib/data";
import { aggregate, applicable, evaluate, inTarget, overlaps, rank, registrationLoad, sanitizeState } from "../src/lib/rules";
const fresh = () => structuredClone(DEFAULT_STATE);
const synthetic = (id:string, category:Course["category"], credits:number, family:string|null=null):Course => ({...courses[0],id,name:id,credits,category,creditFamily:family,creditStatus:"countable"});
const fall = offerings.find(o=>inTarget(o,DEFAULT_STATE.profile)&&evaluate(o,DEFAULT_STATE).status!=="blocked")!;

test("catalog keeps 303 identities, 266 offerings and their explicit IDs",()=>{
  assert.equal(courses.length,303);assert.equal(offerings.length,266);
  assert.equal(new Set(courses.map(c=>c.id)).size,303);
  assert.ok(offerings.every(o=>courseById.has(o.courseId)));
  assert.ok(!courses.some(c=>c.code.startsWith("DEMO")));
});
test("real-data state starts without invented completions or plans",()=>{
  assert.deepEqual(DEFAULT_STATE.completed,[]);assert.deepEqual(DEFAULT_STATE.planned,[]);
  assert.equal(DEFAULT_STATE.profile.admissionYear,2025);assert.equal(aggregate([]).total,0);
});
test("wrong admission year holds the requirement check",()=>{
  const s=fresh();s.profile.admissionYear=2024;
  assert.equal(applicable(s.profile),false);
  assert.ok(evaluate(fall,s).reasons.some(r=>r.includes("要件は未対応")));
});
test("duplicate completions and 0.5-credit PE are counted accurately",()=>{
  const ids=rules.physical_education_rule.course_ids.slice(0,2);
  const a=aggregate([...ids,...ids]);assert.equal(a.total,1);
  assert.equal(a.checks.find(x=>x.label==="基礎体育")?.earned,2);
});
test("surplus moves into free electives without double counting",()=>{
  const catalog=[synthetic("g1","liberal_arts",6),synthetic("g2","liberal_arts",6)];
  const a=aggregate(["g1","g2"],catalog);
  assert.equal(a.total,12);assert.equal(a.breakdown.find(b=>b.id==="liberal_arts")?.earned,10);
  assert.equal(a.breakdown.find(b=>b.id==="free_electives")?.earned,2);
});
test("special lecture cap excess cannot leak into free electives",()=>{
  const catalog=Array.from({length:4},(_,i)=>synthetic("s"+i,"liberal_arts",2,"special_lecture"));
  const a=aggregate(catalog.map(c=>c.id),catalog);
  assert.equal(a.raw,8);assert.equal(a.total,4);assert.equal(a.familyExcess,4);assert.equal(a.surplus,0);
});
test("conditional external and disputed credits stay pending",()=>{
  const external=courses.find(c=>c.creditStatus==="conditional")!;
  const conflict=courses.find(c=>c.name==="未来を拓くイノベーション")!;
  const a=aggregate([external.id,conflict.id]);assert.equal(a.total,0);assert.equal(a.pending.length,2);
  assert.equal(conflict.credits,1);assert.equal(offerings.find(o=>o.courseId===conflict.id)?.credits,2);
});
test("graduation excluded subjects never count",()=>{
  const c=courses.find(c=>c.creditStatus==="excluded")!;
  assert.ok(c);assert.equal(aggregate([c.id]).total,0);assert.equal(aggregate([c.id]).excluded.length,1);
});
test("same weekday-period in different quarters is allowed",()=>{
  const a={...fall,slots:[{day:0,period:2,quarters:[3]}]};
  const b={...fall,id:"another",slots:[{day:0,period:2,quarters:[4]}]};
  assert.equal(overlaps(a,b),false);assert.equal(overlaps(a,{...b,slots:[{day:0,period:2,quarters:[3]}]}),true);
  assert.equal(overlaps(a,{...a,academicYear:2027}),false);
});
test("all slots in a multi-period offering are checked",()=>{
  const a={...fall,slots:[{day:1,period:2,quarters:[3]},{day:1,period:3,quarters:[3]}]};
  const b={...fall,id:"other",slots:[{day:1,period:3,quarters:[3]}]};
  assert.equal(overlaps(a,b),true);
});
test("semester and academic year filter uses quarter memberships",()=>{
  assert.equal(inTarget({...fall,quarters:[3,4]},fresh().profile),true);
  assert.equal(inTarget({...fall,quarters:[1,2]},fresh().profile),false);
  assert.equal(inTarget({...fall,academicYear:2027},fresh().profile),false);
});
test("hard day constraints block while soft preferences remain tentative",()=>{
  const s=fresh();s.preferences.avoidDays=[fall.slots[0].day];
  assert.notEqual(evaluate(fall,s).status,"blocked");s.preferences.dayMode="strict";
  assert.equal(evaluate(fall,s).status,"blocked");
});
test("same subject cannot be scheduled twice under different section IDs",()=>{
  const pair=offerings.find(o=>o.id!==fall.id&&o.courseId===fall.courseId);
  if(!pair) { assert.ok(offerings.some(o=>offerings.some(p=>p.id!==o.id&&p.courseId===o.courseId)));return; }
  const s=fresh();s.planned=[pair.id];assert.equal(evaluate(fall,s).status,"blocked");
});
test("personal eligibility is never certified from syllabus prose",()=>{
  assert.equal(evaluate(fall,fresh()).status,"unknown");
  assert.ok(evaluate(fall,fresh()).reasons.some(r=>r.includes("個別確認")));
});
test("assessment stays as source text with unknown classified percentages",()=>{
  assert.ok(offerings.every(o=>o.assessment===null));
  const s=fresh();s.preferences.assessment="report";
  assert.ok(!rank(fall,s).reasons.some(r=>/[0-9]+％/.test(r)));
});
test("elective groups and DS checks are embedded, not added to total",()=>{
  const ids=rules.data_science_requirement.DS_course_ids;
  const a=aggregate(ids);const expected=courses.filter(c=>ids.includes(c.id)).reduce((s,c)=>s+c.credits,0);
  assert.equal(a.total,expected);assert.equal(a.checks.find(c=>c.label==="DS科目")?.earned,expected);
  assert.equal(requirement.categories.reduce((s,c)=>s+c.required,0),124);
});
test("import rejects demo/other datasets and removes unknown and duplicate IDs",()=>{
  assert.equal(sanitizeState({version:1}),null);
  const s=fresh();s.completed=[courses[0].id,courses[0].id,"c01"];
  assert.deepEqual(sanitizeState(s)?.completed,[courses[0].id]);
  assert.equal(sanitizeState({...s,datasetId:"other"}),null);
  assert.equal(sanitizeState({...s,preferences:{...s.preferences,avoidDays:[7]}}),null);
  assert.equal(s.datasetId,DATASET_ID);
});
test("CAP reference counts planned source credits",()=>{
  const s=fresh();s.planned=[fall.id];assert.equal(registrationLoad(s),fall.credits);
});
