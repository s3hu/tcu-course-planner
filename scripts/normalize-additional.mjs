import fs from "node:fs";
const filename=process.argv[2];if(!filename)throw Error("Usage: node scripts/normalize-additional.mjs <provided-json>");
const input=JSON.parse(fs.readFileSync(filename,"utf8"));
if(input.kind!=="additional_handbook_extraction"||input.schema_version!=="1.0.0")throw Error("Unsupported input schema");
const fields=["course_id","title","credits","category","required_type","elective_group","program_tags","course_number","notes","scope","source","allocation_cells_raw"];
const output=input.handbooks.map(h=>({year:h.curriculum_year,source:Object.fromEntries(Object.entries(h.source).filter(([k])=>k!=="local_path")),rules:h.graduation_rules,issues:h.known_issues,courses:h.courses.filter(c=>["common","social_media"].includes(c.scope)).map(c=>Object.fromEntries(fields.map(k=>[k,c[k]??null])))}));
for(const h of output)if(new Set(h.courses.map(c=>c.course_id)).size!==h.courses.length)throw Error("Duplicate IDs in "+h.year);
fs.writeFileSync("src/data/additional-catalog.json",JSON.stringify(output));
console.log("Normalized "+output.map(h=>h.year+":"+h.courses.length).join(", "));
