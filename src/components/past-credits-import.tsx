"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIES, type Category, type Course } from "@/lib/data";
import { MAX_CUSTOM_NAME, matchPastCredits, recognitionByCourse, sanitizeCustomCredit, type CreditMatch, type CustomCompleted } from "@/lib/past-credits";
import Dialog from "./dialog";

type CustomDraft = { name: string; credits: string; category: string; satisfiesCourseIds: string[] };
const emptyDraft: CustomDraft = { name: "", credits: "", category: "", satisfiesCourseIds: [] };
const MAX_TEXT = 50_000;
const MAX_LINES = 500;

function CustomFields({ draft, categories, onChange }: {
  draft: CustomDraft;
  categories: readonly Category[];
  onChange: (draft: CustomDraft) => void;
}) {
  return <div className="past-credit-fields">
    <label>科目名<input required maxLength={MAX_CUSTOM_NAME} value={draft.name} onChange={e => onChange({ ...draft, name: e.target.value })}/></label>
    <label>単位数<input required type="number" inputMode="decimal" step="any" min={0} max={999} value={draft.credits} onChange={e => onChange({ ...draft, credits: e.target.value })}/></label>
    <label>単位区分<select required value={draft.category} onChange={e => onChange({ ...draft, category: e.target.value })}>
      <option value="">選択してください</option>
      {categories.map(category => <option key={category} value={category}>{CATEGORIES[category].label}</option>)}
    </select></label>
  </div>;
}

function readDraft(draft: CustomDraft, categories: readonly Category[], courseIds?: ReadonlySet<string>) {
  return sanitizeCustomCredit({ ...draft, credits: Number(draft.credits) }, categories, courseIds);
}

export function CustomCreditDialog({ categories, courses, existing, initial, onSave, onClose }: {
  categories: readonly Category[];
  courses: readonly Pick<Course, "id" | "name" | "code" | "requiredType">[];
  existing: readonly CustomCompleted[];
  initial?: CustomCompleted;
  onSave: (credit: CustomCompleted) => boolean | void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomDraft>(() => initial
    ? { ...initial, credits: String(initial.credits), satisfiesCourseIds: initial.satisfiesCourseIds ?? [] }
    : emptyDraft);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const term = query.trim().normalize("NFKC").toLowerCase();
  const selectedIds = new Set(draft.satisfiesCourseIds);
  const claimed = recognitionByCourse(existing.filter(credit => credit !== initial));
  const available = courses.filter(course => !claimed.has(course.id));
  const shown = available.filter(course => selectedIds.has(course.id) || (term
    ? (course.name + " " + course.code).normalize("NFKC").toLowerCase().includes(term)
    : course.requiredType === "required"));
  return <Dialog title={initial ? "自由入力科目を編集" : "カタログ外の科目を記録"} onClose={onClose}>
    <form className="past-credit-stack" onSubmit={e => {
      e.preventDefault();
      const credit = readDraft(draft, categories, new Set(available.map(course => course.id)));
      if (!credit) setError("科目名・正の単位数・単位区分を確認してください。");
      else if (onSave(credit) === false) setError("同じ科目名・単位数・区分の自由入力科目が既にあります。");
    }}>
      <p>入力した単位を区分別・卒業算入の合計に加えます。認定・免除の対象科目を選ぶと、必修や内訳の充足にも反映します。</p>
      <CustomFields draft={draft} categories={categories} onChange={setDraft}/>
      <details className="advanced-preferences">
        <summary>認定・免除する科目（任意・{selectedIds.size}科目選択中）</summary>
        <label className="past-credit-choice">対象科目を検索
          <input type="search" value={query} placeholder="科目名・科目コード" onChange={e => setQuery(e.target.value)}/>
        </label>
        <p className="fine-print">初期表示は必修科目です。選択必修など、ほかの対象科目は検索できます。</p>
        <div className="past-credit-review">
          {shown.map(course => <label className="past-credit-check" key={course.id}>
            <input type="checkbox" checked={selectedIds.has(course.id)} onChange={e => {
              const checked = e.target.checked;
              setDraft(current => ({
                ...current,
                satisfiesCourseIds: checked ? [...current.satisfiesCourseIds, course.id]
                  : current.satisfiesCourseIds.filter(id => id !== course.id),
              }));
            }}/>
            {course.name}（{course.code}）
          </label>)}
          {!shown.length && <p>選べる科目がありません。</p>}
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" type="submit">{initial ? "変更を保存" : "自由入力科目を追加"}</button>
    </form>
  </Dialog>;
}

type ImportCourse = Pick<Course, "id" | "name" | "code" | "category"> & { credits: number | null };

type ReviewRow = { match: CreditMatch<ImportCourse>; choice: string; draft: CustomDraft; index: number };
type OcrMessage =
  | { type: "progress"; status: string; progress: number }
  | { type: "result"; text: string }
  | { type: "error" };

export default function PastCreditsImport({ courses, categories, completed, onApply, onClose }: {
  courses: readonly ImportCourse[];
  categories: readonly Category[];
  completed: readonly string[];
  onApply: (ids: string[], custom: CustomCompleted[], pending: number, excluded: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [progress, setProgress] = useState<{ label: string; percent?: number } | null>(null);
  const [message, setMessage] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    workerRef.current?.terminate();
    window.clearTimeout(timeoutRef.current);
  }, []);

  function review(input: string, allowEdit = false) {
    if (input.length > MAX_TEXT || input.split(/\r\n?|\n/u).length > MAX_LINES) {
      setMessage("一度に照合できるのは500行・5万文字までです。入力を分けてください。");
      return;
    }
    const matches = matchPastCredits(input, courses);
    if (!matches.length) {
      setMessage(allowEdit ? "科目名を読み取れませんでした。画像を選び直すか、テキストを編集してください。" : "照合できる科目名を入力してください。");
      return;
    }
    setRows(matches.map((match, index) => ({
      match, index,
      choice: match.status === "matched" ? match.course.id : "",
      draft: { ...emptyDraft, name: match.name.slice(0, MAX_CUSTOM_NAME) },
    })));
    setMessage("");
  }

  function stopOcr() {
    workerRef.current?.terminate();
    workerRef.current = null;
    window.clearTimeout(timeoutRef.current);
    setProgress(null);
  }

  function startOcr(file: File) {
    stopOcr();
    if (!file.type.startsWith("image/")) {
      setMessage("画像ファイルを選んでください。");
      return;
    }
    setMessage("");
    setProgress({ label: "読み取りエンジンと日本語データを準備中…" });
    function fail() {
      stopOcr();
      setMessage("画像を読み取れませんでした。接続を確認してPNG・JPEG画像で試すか、テキストを貼り付けてください。");
    }
    try {
      const worker = new Worker(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/past-credits-ocr.js`);
      workerRef.current = worker;
      worker.onerror = () => { if (workerRef.current === worker) fail(); };
      worker.onmessage = ({ data }: MessageEvent<OcrMessage>) => {
        if (workerRef.current !== worker) return;
        if (data.type === "progress") {
          const recognizing = data.status === "recognizing text";
          setProgress(recognizing
            ? { label: "画像を読み取り中…", percent: Math.round(data.progress * 100) }
            : { label: "読み取りエンジンと日本語データを準備中…" });
        } else if (data.type === "result") {
          stopOcr();
          setText(data.text);
          review(data.text, true);
        } else {
          fail();
        }
      };
      timeoutRef.current = window.setTimeout(fail, 120_000);
      worker.postMessage(file);
    } catch {
      fail();
    }
  }

  function updateRow(index: number, change: Partial<Pick<ReviewRow, "choice" | "draft">>) {
    setRows(current => current?.map(row => row.index === index ? { ...row, ...change } : row) ?? null);
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    if (!rows) return;
    const ids: string[] = [];
    const custom: CustomCompleted[] = [];
    let pending = 0;
    let excluded = 0;
    for (const { choice, draft } of rows) {
      if (!choice) pending++;
      else if (choice === "exclude") excluded++;
      else if (choice === "custom") {
        const credit = readDraft(draft, categories);
        if (!credit) {
          setMessage("自由入力科目の科目名・正の単位数・単位区分を確認してください。");
          return;
        }
        custom.push(credit);
      } else ids.push(choice);
    }
    onApply(ids, custom, pending, excluded);
  }

  return <Dialog title={rows ? "取り込み内容を確認" : "修得科目をまとめて記録する"} onClose={onClose}>
    {rows ? <form className="past-credit-stack" onSubmit={apply}>
      <p>元の成績と照らし合わせ、修得済みの科目だけ選んでください。</p>
      {([["matched", "一致"], ["review", "要確認"], ["unmatched", "未一致"]] as const).map(([status, title]) => {
        const group = rows.filter(row => row.match.status === status);
        if (!group.length) return null;
        return <fieldset className="past-credit-review" key={status}>
          <legend>{title}（{group.length}件）</legend>
          {group.map(({ match, choice, draft, index }) => <div className="past-credit-row" key={index}>
            {match.status === "matched" ? <label className="past-credit-check">
              <input type="checkbox" checked={choice === match.course.id} onChange={e => updateRow(index, { choice: e.target.checked ? match.course.id : "exclude" })}/>
              {match.course.name}（{match.course.credits === null ? "単位数未確認" : match.course.credits + "単位"}）{completed.includes(match.course.id) && "・記録済み"}
            </label> : <label className="past-credit-choice">
              {match.name}
              <select value={choice} onChange={e => updateRow(index, { choice: e.target.value })}>
                <option value="">未処理</option>
                {match.status === "review" && match.candidates.map(({ course }) =>
                  <option key={course.id} value={course.id}>{course.name}（{course.credits === null ? "単位数未確認" : course.credits + "単位"}・{CATEGORIES[course.category].label}・{course.code}）</option>)}
                <option value="custom">自由入力として追加</option>
                <option value="exclude">除外</option>
              </select>
            </label>}
            <small className="muted">元の行　{match.source}</small>
            {choice === "custom" && <CustomFields draft={draft} categories={categories} onChange={draft => updateRow(index, { draft })}/>}
          </div>)}
        </fieldset>;
      })}
      {message && <p role="alert">{message}</p>}
      <div className="past-credit-actions">
        <button className="button secondary" type="button" onClick={() => { setRows(null); setMessage(""); }}>入力に戻る</button>
        <button className="button primary" type="submit">確認して反映する</button>
      </div>
    </form> : <div className="past-credit-stack">
      <label className="past-credit-choice">テキストを貼り付け
        <textarea rows={7} value={text} disabled={progress !== null} onChange={e => setText(e.target.value)}
          placeholder="修得済みの成績行、または1行に1科目名"/>
      </label>
      <button className="button primary" disabled={!text.trim() || progress !== null} onClick={() => review(text)}>テキストを照合する</button>
      <div className="past-credit-stack past-credit-image">
        <label className="past-credit-choice">写真・スクリーンショット
          <input type="file" accept="image/*" disabled={progress !== null} onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) startOcr(file);
          }}/>
        </label>
        <p className="muted">画像はブラウザ内で読み取り、外部に送信しません。読み取り時にOCR用のプログラムと日本語データを取得します。</p>
        {progress && <div className="past-credit-stack">
          <p role="status">{progress.label}{progress.percent !== undefined && ` ${progress.percent}%`}</p>
          <progress aria-label="画像の読み取り進捗" max={100} value={progress.percent}/>
          <button className="button secondary" onClick={() => { stopOcr(); setMessage("読み取りを中止しました。"); }}>読み取りを中止</button>
        </div>}
      </div>
      {message && <p role="status">{message}</p>}
    </div>}
  </Dialog>;
}
