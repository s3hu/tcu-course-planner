import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_STATE,offerings,offeringById,requirement,type Offering} from "../src/lib/data";
import {evaluate,inTarget,overlaps,registrationLoad} from "../src/lib/rules";
import {generateSchedules,matchesCampus,reportOnly} from "../src/lib/scheduling";
const fresh=()=>structuredClone(DEFAULT_STATE);
test("automatic proposals obey campus, term, credit cap and collision constraints",()=>{
 const s=fresh();s.preferences.avoidDays=[0];s.preferences.dayMode="strict";s.preferences.avoidPeriods=[1];
 const result=generateSchedules(s,{targetCredits:20,preserveExisting:false});
 assert.ok(result.drafts.length>1);assert.ok(result.drafts.length<=8);
 const keys=new Set<string>();
 for(const d of result.drafts){assert.ok(d.credits<=20);assert.equal(registrationLoad({...s,planned:d.planned}),d.credits);const os=d.planned.map(id=>offeringById.get(id)!);
 assert.equal(new Set(os.map(o=>o.courseId)).size,os.length);
 for(const [i,o] of os.entries()){assert.ok(inTarget(o,s.profile));assert.ok(matchesCampus(o,s.preferences.campus));assert.ok(!o.slots.some(x=>x.day===0||x.period===1));assert.notEqual(evaluate(o,{...s,planned:d.planned}).status,"blocked");for(const other of os.slice(i+1))assert.equal(overlaps(o,other),false);}
 const key=[...d.planned].sort().join("|");assert.ok(!keys.has(key));keys.add(key);
 }
});
test("fixed choices are preserved and over-target plans rejected",()=>{
 const s=fresh(),o=offerings.find(o=>inTarget(o,s.profile)&&matchesCampus(o)&&o.credits>1&&o.slots.length&&evaluate(o,s).status!=="blocked")!;
 s.planned=[o.id];const result=generateSchedules(s,{targetCredits:12,preserveExisting:true});assert.ok(result.drafts.length);assert.ok(result.drafts.every(d=>d.planned.includes(o.id)));
 assert.equal(generateSchedules(s,{targetCredits:1,preserveExisting:true}).drafts.length,0);
});
test("unknown on-demand delivery is never inferred from Setagaya campus",()=>{
 const sc=offerings.find(o=>o.meetings.every(m=>m.campus_code==="SC"))!;
 assert.equal(matchesCampus(sc,"setagaya-ondemand"),false);assert.equal(matchesCampus(sc,"setagaya"),true);
 const verified={...sc,reviewedDelivery:{mode:"on-demand",sourceUrl:"https://www.tcu.ac.jp/"}} as Offering;
 assert.equal(matchesCampus(verified,"setagaya-ondemand"),true);
 const s=fresh();s.preferences.campus="setagaya-ondemand";
 assert.equal(generateSchedules(s,{targetCredits:20,preserveExisting:false}).drafts.length,0);
});
test("report filter uses reviewed grading, not incidental mention of reports",()=>{
 assert.equal(reportOnly(offerings.find(o=>o.id==="2026:ybb702101")!),true);
 assert.equal(reportOnly(offerings.find(o=>o.name.includes("情報リテラシー演習"))!),false);
 const s=fresh();s.preferences.reportOnly=true;s.preferences.campus="all";
 for(const d of generateSchedules(s,{targetCredits:20,preserveExisting:false}).drafts)assert.ok(d.planned.every(id=>requirement.mandatoryIds.includes(offeringById.get(id)!.courseId)||reportOnly(offeringById.get(id)!)));
});
test("unsupported profile cannot produce plans",()=>{const s=fresh();s.profile.admissionYear=2024;assert.equal(generateSchedules(s,{targetCredits:20,preserveExisting:false}).drafts.length,0);});
