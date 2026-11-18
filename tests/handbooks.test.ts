import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_STATE,offeringById} from "../src/lib/data";
import {overlaps} from "../src/lib/rules";
import {CREDIT_TAGS} from "../src/lib/credit-tags";
import {aggregateHandbook,getHandbook,handbooks,handbookOfferings,handbookOfferingIssues,handbookCandidates,sanitizeHandbookState,supportsHandbookProfile,normalizeCourseTitle,handbookReplacement,type HandbookState} from "../src/lib/handbooks";
const profile=(year:number)=>({...DEFAULT_STATE.profile,admissionYear:year});
test("four handbook curricula keep own and common subjects isolated by entry year",()=>{assert.deepEqual(handbooks.map(h=>[h.year,h.courses.length]),[[2022,252],[2023,255],[2024,258],[2026,265]]);for(const h of handbooks){assert.equal(new Set(h.courses.map(c=>c.id)).size,h.courses.length);assert.ok(h.courses.every(c=>c.curriculumYear===h.year&&["common","social_media"].includes(c.catalogScope)&&c.creditTagIds.every(id=>!!CREDIT_TAGS[id])));assert.equal(supportsHandbookProfile(profile(h.year)),true);}assert.equal(supportsHandbookProfile({...profile(2026),department:"情報システム学科"}),false);assert.equal(getHandbook(2027),undefined);});
test("2022 PBL credits stay separate while 2024 PBL belongs to foundation",()=>{for(const year of [2022,2024]){const h=getHandbook(year)!,pbl=h.courses.filter(c=>/^SD PBL\([123]\)$/.test(c.name));assert.equal(pbl.length,3);const a=aggregateHandbook(h,pbl.map(c=>c.id));assert.equal(a.total,3);if(year===2022){assert.ok(pbl.every(c=>c.category==="pbl"));assert.equal(a.breakdown.find(b=>b.id==="pbl")?.earned,3);assert.equal(a.breakdown.find(b=>b.id==="professional_foundation")?.required,30);}else{assert.ok(pbl.every(c=>c.category==="professional_foundation"));assert.equal(a.breakdown.find(b=>b.id==="professional_foundation")?.earned,3);assert.equal(a.breakdown.find(b=>b.id==="professional_foundation")?.required,33);}}});
test("family caps follow the entry handbook and excess never leaks to free electives",()=>{for(const year of [2023,2024,2026]){const original=getHandbook(year)!,base=original.courses.find(c=>c.creditFamily==="教養特別講義")!;assert.ok(base);const h={...original,courses:Array.from({length:4},(_,i)=>({...base,id:"fixture-theme-"+i,credits:2}))};const a=aggregateHandbook(h,h.courses.map(c=>c.id));assert.equal(a.total,year===2023?4:6);assert.equal(a.breakdown.find(x=>x.id==="free_electives")?.raw,0);assert.equal(a.familyExcess,year===2023?4:2);}});
test("duplicate and foreign-curriculum completions cannot inflate the total",()=>{const a=getHandbook(2024)!,b=getHandbook(2026)!;const c=a.courses.find(c=>c.credits===.5)!;assert.equal(aggregateHandbook(a,[c.id,c.id,b.courses[0].id]).total,.5);assert.equal(aggregateHandbook(b,[c.id]).total,0);const all=aggregateHandbook(a,a.courses.filter(c=>c.category==="foreign_language").map(c=>c.id));assert.ok(all.surplus>0);assert.equal(all.total,a.courses.filter(c=>c.category==="foreign_language").reduce((n,c)=>n+c.credits,0));});
test("cross-year opening references require an explicit cohort range and unique title+credits",()=>{for(const h of handbooks){const os=handbookOfferings(h.year);assert.ok(os.length>0);for(const o of os){const source=offeringById.get(o.sourceOfferingId)!,c=h.courses.find(c=>c.id===o.courseId)!;assert.ok(source.meetings.every(m=>!!m.eligible_enrollment_years&&h.year>=m.eligible_enrollment_years.from&&h.year<=m.eligible_enrollment_years.through));assert.equal(c.credits,o.credits);assert.equal(normalizeCourseTitle(c.name),normalizeCourseTitle(source.name));assert.equal(o.syllabusReferenceYear,2025);assert.equal(o.catalogYear,h.year);}}});
test("quarter filtering and other-meeting clashes remain effective for added curricula",()=>{const h=getHandbook(2024)!,p=profile(2024),os=handbookOfferings(2024).filter(o=>o.quarters.includes(3));const pair=os.flatMap(a=>os.filter(b=>b.id!==a.id&&b.courseId!==a.courseId&&overlaps(a,b)).map(b=>[a,b])).find(([a,b])=>!handbookOfferingIssues(h,a,p,[],[]).length&&!handbookOfferingIssues(h,b,p,[],[]).length);assert.ok(pair);const [a,b]=pair;assert.ok(handbookOfferingIssues(h,b,p,[],[a.id]).some(x=>x.includes("時間が重なる")));const m=a.slots.find(s=>s.quarters.includes(3))!;assert.ok(handbookCandidates(h,p,3,m.day,m.period,[],[],"all").some(r=>r.offering.id===a.id));assert.equal(handbookCandidates(h,p,1,m.day,m.period,[],[],"all").length,0);assert.ok(handbookOfferingIssues(h,a,p,[a.courseId],[]).some(x=>x.includes("修得済み")));});
test("imports validate dataset, curriculum, year and identities",()=>{const h=getHandbook(2026)!;const s:HandbookState={version:1,datasetId:"tcu-handbooks-v1",profile:profile(2026),completed:[h.courses[0].id,h.courses[0].id],planned:[],campus:"yokohama"};assert.equal(sanitizeHandbookState(s)?.completed.length,1);assert.equal(sanitizeHandbookState({...s,completed:[getHandbook(2024)!.courses[0].id]}),null);assert.equal(sanitizeHandbookState({...s,profile:profile(2025)}),null);assert.equal(sanitizeHandbookState({...s,profile:{...s.profile,academicYear:2027}}),null);assert.equal(sanitizeHandbookState({...s,planned:["unknown"]}),null);});
test("graduation totals and original CAP wording remain edition-specific",()=>{for(const h of handbooks){assert.equal(Object.values(h.rules.category_minimum_credits).reduce((a,b)=>a+b,0),124);assert.equal(aggregateHandbook(h,[]).total,0);assert.equal(aggregateHandbook(h,[]).missingRequired.length,19);}assert.equal(getHandbook(2022)!.rules.registration_cap.threshold_operator,">");assert.equal(getHandbook(2023)!.rules.registration_cap.threshold_operator,">=");assert.equal(getHandbook(2026)!.rules.registration_cap.default_credits_per_semester,24);});

test("replacement removes every overlapping quarter meeting and preserves unrelated plans",()=>{
 const h=getHandbook(2024)!,p=profile(2024),all=handbookOfferings(2024);
 const target=all.find(o=>o.name==="コンピュータシステム"&&o.quarters.includes(3))!;
 assert.ok(target);assert.ok(target.slots.length>1);
 const conflicts=target.slots.map(s=>all.find(x=>x.id!==target.id&&x.courseId!==target.courseId&&x.slots.some(t=>t.day===s.day&&t.period===s.period&&t.quarters.some(q=>s.quarters.includes(q))))) .filter(Boolean) as typeof all;
 const other=all.find(x=>x.id!==target.id&&!overlaps(target,x)&&!conflicts.some(c=>c.id===x.id))!;
 const selected=[...new Set([...conflicts.map(x=>x.id),other.id])];
 const result=handbookReplacement(h,target,p,[],selected);
 assert.ok(result.canReplace);assert.deepEqual(result.remaining,[other.id]);
 assert.ok(result.conflicts.length);assert.equal(handbookOfferingIssues(h,target,p,[],result.remaining).length,0);
});
test("replacement cannot bypass completed subjects or progression prerequisites",()=>{
 const h=getHandbook(2024)!,p=profile(2024),all=handbookOfferings(2024);
 const target=all.find(o=>o.name==="コンピュータシステム"&&o.quarters.includes(3))!;
 const conflict=all.find(x=>x.id!==target.id&&overlaps(x,target))!;
 assert.ok(target&&conflict);
 const blocked=handbookReplacement(h,target,p,[target.courseId],[conflict.id]);
 assert.equal(blocked.canReplace,false);assert.ok(blocked.issues.includes("修得済みの科目です"));
 const graduation=all.find(o=>o.name==="卒業研究(1)")!;
 if(graduation){assert.equal(handbookReplacement(h,graduation,p,[],[]).canReplace,false);}
});
