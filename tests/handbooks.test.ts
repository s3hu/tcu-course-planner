import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_STATE,courseById,offeringById} from "../src/lib/data";
import {overlaps} from "../src/lib/rules";
import {CREDIT_TAGS} from "../src/lib/credit-tags";
import {DESIGN_DATA_SCIENCE,DESIGN_FACULTY,ENVIRONMENTAL_CREATION,ENVIRONMENTAL_MANAGEMENT,ENVIRONMENT_FACULTY,HANDBOOK_FACULTIES,INFORMATION_SYSTEMS,MEDIA_FACULTY,handbookDepartments,aggregateHandbook,getHandbook,handbooks,handbookOfferings,handbookOfferingIssues,handbookCandidates,sanitizeHandbookState,supportsHandbookProfile,normalizeCourseTitle,handbookReplacement,type HandbookState} from "../src/lib/handbooks";
const profile=(year:number)=>({...DEFAULT_STATE.profile,admissionYear:year});
test("four handbook curricula keep own and common subjects isolated by entry year",()=>{assert.deepEqual(handbooks.map(h=>[h.year,h.courses.length]),[[2022,252],[2023,255],[2024,258],[2026,265]]);for(const h of handbooks){assert.equal(new Set(h.courses.map(c=>c.id)).size,h.courses.length);assert.ok(h.courses.every(c=>c.curriculumYear===h.year&&["common","social_media"].includes(c.catalogScope)&&c.creditTagIds.every(id=>!!CREDIT_TAGS[id])));assert.equal(supportsHandbookProfile(profile(h.year)),true);}assert.equal(supportsHandbookProfile({...profile(2022),department:INFORMATION_SYSTEMS}),false);assert.equal(getHandbook(2027),undefined);});
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

const informationSystemsProfile = (year:number) => ({...profile(year), department:INFORMATION_SYSTEMS});

test("information systems curricula share faculty subjects and preserve department-specific requirements",()=>{
 const cohorts = [
  {year:2023, common:189, department:64, page:107},
  {year:2024, common:192, department:64, page:105},
  {year:2025, common:193, department:76, page:106},
  {year:2026, common:191, department:72, page:105},
 ];
 for(const expected of cohorts){
  const {year}=expected;
  const h=getHandbook(year, INFORMATION_SYSTEMS)!;
  const common=h.courses.filter(c=>c.catalogScope==="common");
  const own=h.courses.filter(c=>c.catalogScope==="information_systems");
  assert.equal(supportsHandbookProfile(informationSystemsProfile(year)),true);
  assert.equal(supportsHandbookProfile({...informationSystemsProfile(year),faculty:"別学部"}),false);
  assert.equal(new Set(h.courses.map(c=>c.id)).size,expected.common+expected.department);
  assert.equal(common.length,expected.common);
  assert.equal(own.length,expected.department);
  assert.ok(h.courses.every(c=>c.department===INFORMATION_SYSTEMS&&c.curriculumYear===year));
  assert.ok(own.filter(c=>c.code.startsWith("IF-")).every(c=>c.source.pdf_page===expected.page&&c.allocationCellsRaw.length===8));
  const social=getHandbook(year);
  if(social)assert.deepEqual(common.map(c=>c.id),social.courses.filter(c=>c.catalogScope==="common").map(c=>c.id));
  const mandatory=aggregateHandbook(h,[]).missingRequired;
  const requiredCredits = (category:string) => mandatory.filter(c=>c.category===category).reduce((sum,c)=>sum+c.credits,0);
  assert.equal(requiredCredits("professional_foundation"),13);
  assert.equal(requiredCredits("professional"),27);
  assert.equal(h.rules.minimum_total_credits,124);
  assert.equal(h.rules.data_science_minimum_credits,1);
  assert.equal(h.rules.data_science_plus_mathematics_minimum_credits,4);
  const programming=own.find(c=>c.code==="IF-221")!;
  const physical=common.filter(c=>c.category==="physical_education"&&c.electiveGroup==="△");
  const electiveCheck=(ids:string[])=>aggregateHandbook(h,ids).checks.find(c=>c.label==="選択必修 △");
  assert.deepEqual(electiveCheck(physical.map(c=>c.id)),{label:"選択必修 △",earned:0,required:2,unit:"単位"});
  assert.equal(electiveCheck([programming.id])?.earned,2);
 }
 assert.equal(getHandbook(2022, INFORMATION_SYSTEMS),undefined);
 assert.equal(getHandbook(2025),undefined);
});

test("the 2025 information systems catalog keeps separately printed courses and excludes non-countable credit",()=>{
 const h=getHandbook(2025, INFORMATION_SYSTEMS)!;
 const excluded=h.courses.filter(c=>c.creditStatus==="excluded");
 assert.deepEqual(excluded.map(c=>c.code),["FL-941","FL-942"]);
 const summary=aggregateHandbook(h,excluded.map(c=>c.id));
 assert.equal(summary.raw,4);
 assert.equal(summary.total,0);
 assert.equal(summary.surplus,0);
 const sameNumber=h.courses.filter(c=>c.code==="LA-13H");
 assert.deepEqual(sameNumber.map(c=>c.name),["日本文化論","キャリアデザイン基礎"]);
 assert.equal(new Set(sameNumber.map(c=>c.id)).size,2);
});

test("information systems reuses only eligible matched openings and imports its own plans",()=>{
 for(const [year,total,ownCount] of [[2023,192,42],[2024,192,42],[2025,192,42],[2026,87,23]]){
  const h=getHandbook(year, INFORMATION_SYSTEMS)!;
  const rows=handbookOfferings(year, INFORMATION_SYSTEMS);
  assert.equal(rows.length,total);
  assert.equal(rows.filter(o=>h.courses.find(c=>c.id===o.courseId)?.catalogScope==="information_systems").length,ownCount);
  for(const o of rows){
   const source=offeringById.get(o.sourceOfferingId)!;
   assert.ok(source.meetings.every(m=>m.eligible_enrollment_years&&year>=m.eligible_enrollment_years.from&&year<=m.eligible_enrollment_years.through));
   assert.deepEqual(h.courses.filter(c=>normalizeCourseTitle(c.name)===normalizeCourseTitle(source.name)&&c.credits===source.credits).map(c=>c.id),[o.courseId]);
   assert.ok(!courseById.get(source.courseId)?.notes.includes("他学科履修不可"));
   assert.equal(o.catalogDepartment,INFORMATION_SYSTEMS);
  }
 }
 const h=getHandbook(2025, INFORMATION_SYSTEMS)!;
 const own=h.courses.find(c=>c.catalogScope==="information_systems")!;
 const state:HandbookState={version:1,datasetId:"tcu-handbooks-v1",profile:informationSystemsProfile(2025),completed:[own.id],planned:[handbookOfferings(2025, INFORMATION_SYSTEMS)[0].id],campus:"all"};
 assert.deepEqual(sanitizeHandbookState(state),state);
 const older=handbookOfferings(2024, INFORMATION_SYSTEMS)[0];
 assert.equal(sanitizeHandbookState({...state,planned:[older.id]}),null);
 const social=handbookOfferings(2024).find(o=>o.courseId===older.courseId);
 assert.ok(social);
 assert.equal(sanitizeHandbookState({...state,profile:informationSystemsProfile(2024),completed:[],planned:[social.id]}),null);
});

test("information systems progression uses the single case research subject",()=>{
 const h=getHandbook(2023, INFORMATION_SYSTEMS)!;
 const opening=handbookOfferings(2023, INFORMATION_SYSTEMS)[0];
 const caseResearch=h.courses.find(c=>c.code==="IF-313")!;
 const graduation1=h.courses.find(c=>c.code==="IF-412")!;
 const graduation2=h.courses.find(c=>c.code==="IF-413")!;
 const issues=(courseId:string,completed:string[])=>handbookOfferingIssues(h,{...opening,courseId},informationSystemsProfile(2023),completed,[]);
 assert.ok(issues(caseResearch.id,[]).includes("着手条件の66単位に未達です"));
 assert.ok(issues(graduation1.id,[]).includes("着手条件の100単位に未達です"));
 assert.deepEqual(issues(graduation1.id,[]).filter(s=>s.startsWith("前提科目")),[ "前提科目が未修得：事例研究" ]);
 assert.ok(!issues(graduation1.id,[caseResearch.id]).some(s=>s.startsWith("前提科目")));
 assert.ok(issues(graduation2.id,[]).includes("前提科目が未修得：卒業研究(1)"));
});

const yokohamaCohorts = [
 {faculty:ENVIRONMENT_FACULTY, department:ENVIRONMENTAL_CREATION, scope:"environmental_creation", source:"env", courses:[259,262,278,272], common:[192,195,199,197], openings:[150,150,150,63]},
 {faculty:ENVIRONMENT_FACULTY, department:ENVIRONMENTAL_MANAGEMENT, scope:"environmental_management", source:"env", courses:[260,263,279,273], common:[192,195,199,197], openings:[152,152,152,63]},
 {faculty:DESIGN_FACULTY, department:DESIGN_DATA_SCIENCE, scope:"design_data_science", source:"dds", courses:[117,117,129,125], common:[60,60,60,60], openings:[25,25,25,22]},
];

test("faculty and department select only their own supported handbook cohorts",()=>{
 assert.deepEqual(HANDBOOK_FACULTIES,[MEDIA_FACULTY,ENVIRONMENT_FACULTY,DESIGN_FACULTY]);
 assert.deepEqual(handbookDepartments(ENVIRONMENT_FACULTY),[ENVIRONMENTAL_CREATION,ENVIRONMENTAL_MANAGEMENT]);
 assert.deepEqual(handbookDepartments(DESIGN_FACULTY),[DESIGN_DATA_SCIENCE]);
 assert.deepEqual(handbookDepartments("別学部"),[]);
 for(const {faculty,department,scope,source,courses,common} of yokohamaCohorts){
  assert.equal(supportsHandbookProfile({...profile(2022),faculty,department}),false);
  assert.equal(getHandbook(2022,department,faculty),undefined);
  assert.equal(getHandbook(2026,department,MEDIA_FACULTY),undefined);
  for(const [index,year] of [2023,2024,2025,2026].entries()){
   const h=getHandbook(year,department,faculty)!;
   assert.equal(supportsHandbookProfile({...profile(year),faculty,department}),true);
   assert.equal(supportsHandbookProfile({...profile(year),faculty,department:INFORMATION_SYSTEMS}),false);
   assert.equal(new Set(h.courses.map(c=>c.id)).size,courses[index]);
   assert.equal(h.courses.length,courses[index]);
   assert.equal(h.courses.filter(c=>c.catalogScope==="common").length,common[index]);
   assert.ok(h.courses.every(c=>c.curriculumYear===year&&c.department===department&&
    (c.catalogScope==="common"||c.catalogScope===scope)&&c.source.source_id===source+"-"+year&&
    !!c.source.pdf_page&&c.source.pdf_page<=h.source.page_count&&c.creditTagIds.every(id=>!!CREDIT_TAGS[id])));
   assert.equal(Object.values(h.rules.category_minimum_credits).reduce((a,b)=>a+b,0),124);
  }
 }
});

test("environment graduation rows match printed mandatory subtotals and research conditions",()=>{
 for(const year of [2023,2024,2025,2026]){
  const creation=getHandbook(year,ENVIRONMENTAL_CREATION,ENVIRONMENT_FACULTY)!;
  const management=getHandbook(year,ENVIRONMENTAL_MANAGEMENT,ENVIRONMENT_FACULTY)!;
  const commonIds=(h:typeof creation)=>h.courses.filter(c=>c.catalogScope==="common").map(c=>c.id);
  assert.deepEqual(commonIds(creation),commonIds(management));
  for(const [h,foundation,professional] of [[creation,8,20],[management,10,12]] as const){
   const mandatory=aggregateHandbook(h,[]).missingRequired;
   const credits=(category:string)=>mandatory.filter(c=>c.category===category).reduce((sum,c)=>sum+c.credits,0);
   assert.deepEqual([credits("foreign_language"),credits("professional_foundation"),credits("professional")],[4,foundation,professional]);
   assert.deepEqual(h.rules.category_minimum_credits,{foreign_language:8,physical_education:1,liberal_arts:10,professional_foundation:34,professional:60,free_electives:11});
   assert.equal(h.rules.registration_cap.default_credits_per_semester,year<2025?20:24);
   assert.equal(h.rules.graduation_credit_family_caps["教養特別講義"],year===2023?4:6);
   const sports=h.courses.filter(c=>c.category==="physical_education"&&c.electiveGroup==="△").slice(0,2);
   const summary=aggregateHandbook(h,sports.map(c=>c.id));
   assert.deepEqual(summary.checks.filter(c=>c.label.startsWith("基礎体育")).map(c=>[c.earned,c.required]),[[2,2],[1,1]]);
   const research=h.courses.find(c=>c.name==="卒業研究(1)")!;
   const opening=handbookOfferings(year,h.department,h.faculty)[0];
   const issues=handbookOfferingIssues(h,{...opening,courseId:research.id},{...profile(year),faculty:h.faculty,department:h.department},[],[]);
   assert.ok(issues.includes("着手条件の100単位に未達です"));
   assert.deepEqual(issues.filter(s=>s.startsWith("前提科目")),["前提科目が未修得：事例研究(1)","前提科目が未修得：事例研究(2)"]);
  }
 }
});

test("design data science uses separate elective pools and edition-specific TAP guidance",()=>{
 for(const year of [2023,2024,2025,2026]){
  const h=getHandbook(year,DESIGN_DATA_SCIENCE,DESIGN_FACULTY)!;
  const eligible=h.courses.filter(c=>c.category==="professional_applied"&&c.electiveGroup==="△");
  const summary=aggregateHandbook(h,eligible.map(c=>c.id));
  assert.deepEqual(summary.checks.slice(0,4).map(c=>[c.earned,c.required]),[[0,6],[0,4],[0,20],[12,2]]);
  assert.ok(h.courses.filter(c=>c.category==="liberal_arts"||c.category==="foreign_language").every(c=>!c.creditTagIds.includes("basic")));
  assert.deepEqual(h.rules.category_minimum_credits,{liberal_arts:12,foreign_language:14,professional_foundation:50,professional_applied:40,free_electives:8});
  assert.equal(h.rules.study_abroad?.policy,year===2023?"faculty_guidance":"required_in_principle");
  assert.equal(h.rules.progression.year_3_minimum_countable_credits,50);
  assert.equal(h.rules.progression.graduation_research_1_minimum_enrolled_months_excluding_leave,42);
  const capstone=h.courses.find(c=>c.name===h.rules.progression.graduation_research_1_title)!;
  assert.equal(capstone.requiredType,"required");
  const opening=handbookOfferings(year,h.department,h.faculty)[0];
  const issues=handbookOfferingIssues(h,{...opening,courseId:capstone.id},{...profile(year),faculty:h.faculty,department:h.department},[],[]);
  assert.ok(issues.includes("着手条件の110単位に未達です"));
  const omitted=h.courses.filter(c=>c.creditStatus==="excluded").map(c=>c.id);
  const excluded=aggregateHandbook(h,omitted);
  assert.equal(excluded.total,0);
  assert.equal(excluded.raw,year>=2025?12:0);
 }
});

test("new faculty offerings require unique title and credit matches and isolate imported plans",()=>{
 for(const {faculty,department,openings} of yokohamaCohorts){
  for(const [index,year] of [2023,2024,2025,2026].entries()){
   const h=getHandbook(year,department,faculty)!;
   const rows=handbookOfferings(year,department,faculty);
   assert.equal(rows.length,openings[index]);
   for(const o of rows){
    const source=offeringById.get(o.sourceOfferingId)!;
    assert.ok(source.meetings.every(m=>m.eligible_enrollment_years&&year>=m.eligible_enrollment_years.from&&year<=m.eligible_enrollment_years.through));
    assert.deepEqual(h.courses.filter(c=>normalizeCourseTitle(c.name)===normalizeCourseTitle(source.name)&&c.credits===source.credits).map(c=>c.id),[o.courseId]);
    assert.ok(!courseById.get(source.courseId)?.notes.includes("他学科履修不可"));
    assert.equal(o.catalogFaculty,faculty);
    assert.equal(o.catalogDepartment,department);
   }
   const state:HandbookState={version:1,datasetId:"tcu-handbooks-v1",profile:{...profile(year),faculty,department},completed:[h.courses[0].id],planned:[rows[0].id],campus:"all"};
   assert.deepEqual(sanitizeHandbookState(state),state);
   assert.equal(sanitizeHandbookState({...state,profile:{...state.profile,faculty:MEDIA_FACULTY}}),null);
   assert.equal(sanitizeHandbookState({...state,planned:[handbookOfferings(2023,INFORMATION_SYSTEMS)[0].id]}),null);
  }
 }
});
