import { CATEGORIES, type Category } from "./data";

export type CustomCompleted = { name: string; credits: number; category: Category };
type CatalogCourse = { id: string; name: string };
type Candidate<T> = { course: T; similarity: number };
export type CreditMatch<T> =
  | { status: "matched"; name: string; source: string; course: T }
  | { status: "review"; name: string; source: string; candidates: Candidate<T>[] }
  | { status: "unmatched"; name: string; source: string };

export const MAX_CUSTOM_NAME = 200;

export function customCreditCategories(minimums: Record<string, number>): Category[] {
  return Object.keys(CATEGORIES).filter((id): id is Category =>
    id !== "not_counted" && Object.hasOwn(minimums, id));
}

export function sanitizeCustomCredit(value: unknown, categories: readonly Category[]): CustomCompleted | null {
  if (!value || typeof value !== "object") return null;
  const { name, credits, category } = value as Partial<CustomCompleted>;
  if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_CUSTOM_NAME ||
      /[\x00-\x1f\x7f]/u.test(name) || typeof credits !== "number" ||
      !Number.isFinite(credits) || credits <= 0 || credits > 999 ||
      !category || !categories.includes(category)) return null;
  return { name: name.trim(), credits, category };
}

export function normalizeCourseName(name: string): string {
  return name.normalize("NFKC").toLowerCase()
    .replace(/[\s\u200b-\u200d\ufeff()[\]{}【】〔〕「」『』〈〉《》]/gu, "");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    }
    previous = next;
  }
  return previous[b.length];
}

const columnSeparator = /\t+| {2,}|[|｜│┃]+/u;
const courseCode = String.raw`(?:[A-Z]{1,8}[-‐‑–ー ]?\d{2,}[A-Z0-9-]*|\d{4,}[A-Z0-9-]*)`;
const grade = String.raw`(?:[SABCDFP][+−-]?|優|良|可|秀|合格|不合格|認定|不可)`;
const metadata = new RegExp(String.raw`^(?:\d+(?:\.\d+)?\s*(?:単位|年度|年|期|Q)?|${courseCode}|${grade}|前期|後期|通年|[1-4]Q)$`, "iu");
const headers = /^(?:科目名|授業科目名|科目コード|講義コード|成績|単位|単位数|評価|修得年度|学期|修得単位数|合計|小計|修得科目|成績一覧)$/u;
const leadingCode = new RegExp(String.raw`^${courseCode}\s+`, "iu");
const trailingResult = new RegExp(String.raw`(?:\s+\d+(?:\.\d+)?\s*単位(?:\s+${grade})?|\s+\d+(?:\.\d+)?\s+${grade}|\s+${grade}\s+\d+(?:\.\d+)?)$`, "iu");

function extractCourseName(line: string): string {
  const text = line.normalize("NFKC").replace(/^[\s•●・]+/u, "").trim();
  const fields = text.split(columnSeparator).map(field => field.trim()).filter(Boolean);
  const titleFields = fields.filter(field => !metadata.test(field) && !headers.test(field));
  if (fields.length > 1 && titleFields.length === 1) return titleFields[0];
  return text.replace(leadingCode, "").replace(trailingResult, "").trim();
}

export function matchPastCredits<T extends CatalogCourse>(text: string, courses: readonly T[]): CreditMatch<T>[] {
  const catalog = courses.map(course => ({ course, key: normalizeCourseName(course.name) }));
  const results: CreditMatch<T>[] = [];
  for (const line of text.split(/\r\n?|\n/u)) {
    const source = line.trim();
    const fields = source.normalize("NFKC").split(columnSeparator).map(field => field.trim()).filter(Boolean);
    if (!fields.length || fields.every(field => headers.test(field) || metadata.test(field))) continue;
    const name = extractCourseName(source);
    const key = normalizeCourseName(name);
    if (!key || /^[\p{P}\p{S}]+$/u.test(key)) continue;

    const exact = new Set([key, normalizeCourseName(source)]);
    const matches = catalog.filter(item => exact.has(item.key));
    if (matches.length === 1) {
      results.push({ status: "matched", name, source, course: matches[0].course });
      continue;
    }
    const candidates = matches.length > 1
      ? matches.map(({ course }) => ({ course, similarity: 1 }))
      : catalog.flatMap(({ course, key: courseKey }) => {
        const length = Math.max(key.length, courseKey.length);
        const maxEdits = Math.min(4, Math.max(1, Math.floor(length * 0.3)));
        if (Math.abs(key.length - courseKey.length) > maxEdits || Math.min(key.length, courseKey.length) < 2) return [];
        const distance = editDistance(key, courseKey);
        return distance <= maxEdits ? [{ course, similarity: 1 - distance / length }] : [];
      }).sort((a, b) => b.similarity - a.similarity || a.course.name.localeCompare(b.course.name, "ja")).slice(0, 5);
    results.push(candidates.length ? { status: "review", name, source, candidates } : { status: "unmatched", name, source });
  }
  return results;
}

export function customCreditKey(credit: CustomCompleted): string {
  return JSON.stringify([credit.name.normalize("NFKC"), credit.credits, credit.category]);
}
