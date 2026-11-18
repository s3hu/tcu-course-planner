import fs from 'node:fs';
import path from 'node:path';

const input = JSON.parse(fs.readFileSync(path.resolve('data/tcu-social-media-2025.json'), 'utf8'));
if (input.schema_version !== '2.0.0' || !Array.isArray(input.courses) || !Array.isArray(input.offerings)) throw new Error('Unsupported catalog schema');
const compact = {
  schemaVersion: input.schema_version, generatedAt: input.generated_at, scope: input.scope,
  sources: input.sources, rules: input.graduation_rules, issues: input.known_issues,
  validation: input.validation_summary, campuses: input.campuses,
  unmatchedTimetableRows: input.additional_timetable_candidates.length,
  courses: [...input.courses, ...input.supplementary_courses],
  offerings: input.offerings.map(o => ({
    id: o.offering_id, courseId: o.course_id, lectureCode: o.lecture_code, title: o.title,
    academicYear: o.academic_year, credits: o.credits, termLabel: o.term,
    route: o.graduation_credit_route, mappingStatus: o.graduation_credit_mapping_status,
    scheduleStatus: o.schedule_status, meetings: o.meetings,
    registrationNote: o.registration_note ?? null, creditProcedure: o.credit_application_procedure ?? null,
    syllabus: o.syllabus,
  })),
};
const ids = new Set(compact.courses.map(c => c.course_id));
if (ids.size !== compact.courses.length || compact.offerings.some(o => !ids.has(o.courseId))) throw new Error('Invalid course identities');
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/catalog.json', JSON.stringify(compact));
console.log(`Normalized ${compact.courses.length} course identities and ${compact.offerings.length} offerings`);
