"use client";

import { ExternalLink, Info, Plus, Trash2, TriangleAlert } from "lucide-react";
import { CATEGORIES, DAYS, Q_LABELS, courses, courseById, dataIssues, offerings, officialUrl, requirement, rules, source, sourceLabel, sources, type Offering, type PlannerState } from "@/lib/data";
import CreditTags,{CreditCategoryNote} from "./credit-tags";
import { aggregate, evaluate, priorityFor } from "@/lib/rules";

export function DataNotice({ compact = false }: { compact?: boolean }) {
  return <div className={`demo-notice ${compact ? "compact" : ""}`}><span className="demo-tag">2025 社メ</span><span>{compact ? "提供JSONの資料ベースデータ・個別条件は要確認" : "2025年度入学・社会メディア学科／2026年度開講の提供JSONを使用。履修許可・最新訂正・卒業可否は確定しません。"}</span></div>;
}

function RawSection({ title, text }: { title: string; text?: string | null }) {
  return <section className="raw-section"><h3 className="detail-subtitle">{title}</h3><p className="raw-text">{text?.trim() || "記載なし"}</p></section>;
}

export function CourseDetail({ o, state, onAdd }: { o: Offering; state: PlannerState; onAdd: (o: Offering) => void }) {
  const c = courseById.get(o.courseId)!;
  const r = evaluate(o, state);
  const priority=priorityFor(o,state);
  const url = officialUrl(o.syllabus.source.source_url);
  const timetableRefs=o.meetings.map(m=>m.source).filter((s):s is NonNullable<typeof s>=>!!s);
  const timetableSource=sources.find(s=>s.source_id==="uploaded_timetable") as {official_url?:string}|undefined;
  const timetableUrl=officialUrl(timetableSource?.official_url);
  const planned = state.planned.includes(o.id);
  const categorySource = Array.isArray(o.route.source) ? o.route.source : o.route.source ? [o.route.source] : [];
  return <><DataNotice compact /><div className="detail-priority"><strong>優先{priority.tier} · {priority.label}</strong><p>{priority.reasons.join("／")}</p></div><div className="detail-tags"><CreditTags course={c}/><span>{o.credits}単位（シラバス）</span><span>{o.termLabel}</span></div>
    <CreditCategoryNote course={c}/>
    {c.creditStatus === "conflict" && <p className="warning-banner"><TriangleAlert size={17} />単位数が不一致です。科目表 {c.credits}単位／シラバス {o.credits}単位。卒業算入の集計は保留します。</p>}
    <dl className="detail-grid"><div><dt>講義コード（クラス識別）</dt><dd>{o.lectureCode}</dd></div><div><dt>科目ナンバー（参考値）</dt><dd>{c.code}</dd></div><div><dt>年度・学期</dt><dd>{o.academicYear}年度 {o.termLabel}</dd></div><div><dt>配当年次（原文）</dt><dd>{o.syllabus.assigned_year_raw || "記載なし"}</dd></div><div><dt>担当者</dt><dd>{o.teacher}</dd></div><div><dt>キャンパス</dt><dd>{o.campus}</dd></div></dl>
    <section className="source-crosscheck"><h3>3つの資料で照合</h3><p><b>学修要覧</b> {sourceLabel(c.source)}<br/>{requirement.mandatoryIds.includes(c.id)?"○ 必修":"選択・選択必修等（教育課程表を確認）"} · {CATEGORIES[c.category].label}</p><p><b>時間表</b> {[...new Set(timetableRefs.map(sourceLabel))].join("／")||"週次の日時は未確認"}<br/>講義コード：{o.lectureCode} · {o.termLabel}</p><div className="source-quicklinks">{timetableUrl&&timetableRefs.some(s=>s.source_id==="uploaded_timetable")&&<a href={timetableUrl+"#page="+timetableRefs.find(s=>s.source_id==="uploaded_timetable")!.pdf_page} target="_blank" rel="noreferrer">公式時間表の該当ページ<ExternalLink size={13}/></a>}{url&&<a href={url} target="_blank" rel="noreferrer">公式シラバスを開く<ExternalLink size={13}/></a>}</div><small>英語の指定クラス・対象入学年度・最新の訂正を大学の案内と照合してください。</small></section>
    <h3 className="detail-subtitle">開講日時・クラス</h3>{o.meetings.length ? <ul className="meeting-list">{o.meetings.map((m, i) => <li key={i}><strong>{m.weekday && m.period ? `${m.weekday}曜 ${m.period}限` : "日時未確認・集中等"}</strong><span>{m.quarters?.map(q => Q_LABELS[q]).join("・") || "期間未確認"} · {m.room_raw || "教室未確認"}{m.class_label ? ` · ${m.class_label}` : ""}</span>{m.source && <small>{sourceLabel(m.source)}</small>}</li>)}</ul> : <p className="muted">活動・認定等のため、週次の開講日時はありません。</p>}
    <RawSection title="授業の概要（原文）" text={o.syllabus.description} /><RawSection title="到達目標（原文）" text={o.syllabus.goals} />
    <RawSection title="成績評価（原文）" text={o.syllabus.grading_raw} /><p className="fine-print">JSONの割合抽出は検証済み内訳ではありません。試験・レポートの割合への再分類や補完は行っていません。</p>
    <RawSection title="履修条件・前提知識（原文）" text={o.syllabus.prerequisites_raw} />
    {o.registrationNote && <RawSection title="履修上の注意" text={o.registrationNote} />}
    <RawSection title="授業の進め方（原文）" text={o.syllabus.class_flow} />
    <details className="source-details"><summary>教科書・参考書・持ち物</summary><RawSection title="教科書" text={o.syllabus.textbooks_raw} /><RawSection title="参考書" text={o.syllabus.reference_books_raw} /><RawSection title="持ち物" text={o.syllabus.what_to_bring} /></details>
    <div className="warning-banner"><Info size={17} /><div>{r.reasons.map(w => <p key={w}>{w}</p>)}{o.route.conditions?.map(w => <p key={w}>{w}</p>)}</div></div>
    <details className="source-details"><summary>根拠・出典と更新情報</summary><dl><dt>データ</dt><dd>{source.title}</dd><dt>科目表</dt><dd>{sourceLabel(c.source)}</dd><dt>算入区分の根拠</dt><dd>{categorySource.map(sourceLabel).join("／") || "個別確認が必要"}</dd><dt>シラバス取得</dt><dd>{o.syllabus.source.retrieved_at?.slice(0,10) || "未確認"}</dd><dt>シラバス更新（原文）</dt><dd>{o.syllabus.updated_at_raw || "記載なし"}</dd><dt>内部科目ID</dt><dd className="break-word">{c.id}</dd></dl>{url && <a className="button secondary full-width" href={url} target="_blank" rel="noreferrer">公式シラバスを開く<ExternalLink size={14} /></a>}</details>
    <button className={`button ${planned ? "secondary" : "primary"} full-width`} disabled={!planned && r.status === "blocked"} onClick={() => onAdd(o)}>{planned ? <><Trash2 size={15} />仮時間割から削除</> : <><Plus size={15} />{r.status === "blocked" ? "この条件では追加できません" : "要確認のまま仮時間割に置く"}</>}</button><p className="fine-print">仮置きは履修許可・正式登録を意味しません。日時不明の科目は一覧にのみ表示します。</p>
  </>;
}

const ISSUE_LABELS: Record<string, string> = { handbook_subtotal_typo: "専門基礎の小計の記載差", not_a_complete_eligibility_engine: "全例外・卒業可否の判定は未対応", credit_conflict: "「未来を拓くイノベーション」の単位数が不一致", individual_course_permission_not_verified: "個別の履修許可は未確認", activity_recognition_guides_not_verified: "活動認定の別ガイドは未確認", current_timetable_all_corrections_not_audited: "時間表の訂正を全件反映していません", teaching_license_complete_validator_not_implemented: "教員免許の全要件判定は未対応", TAP_personal_recognition_not_verified: "TAP等の個人の認定結果は未確認" };
export function DataSources({ state }: { state: PlannerState }) {
  const a = aggregate(state.completed);
  return <><DataNotice compact /><p className="detail-description">提供JSON v2.0.0の科目表271件と補助科目32件、2026年度開講266件を取り込みました。未照合の時間表候補229行は、確認済みの開講科目として追加していません。</p><dl className="detail-grid"><div><dt>対象入学年度・所属</dt><dd>{requirement.title}</dd></div><div><dt>収録開講年度</dt><dd>2026年度</dd></div><div><dt>提供データ生成日</dt><dd>{source.updatedAt}</dd></div><div><dt>確認状態</dt><dd>資料ベースの草案・全件の再監査は未実施</dd></div></dl>
    <h3 className="detail-subtitle">参照資料</h3><ul className="source-list">{sources.map(s => { const item = s as { source_id: string; title?: string; filename?: string; url?: string; official_url?: string; sha256?: string }; const url = officialUrl(item.url || item.official_url); return <li key={item.source_id}>{url ? <a href={url} target="_blank" rel="noreferrer">{item.title || item.filename || item.source_id}<ExternalLink size={12} /></a> : <span>{item.title || item.filename || item.source_id}（JSON内の出典情報）</span>}</li>; })}</ul>
    <h3 className="detail-subtitle">要件の参考チェック</h3><p className="fine-print">DS・MS、選択必修、外国語などは全体の124単位に内包され、重ねて加算しません。</p><div className="requirement-checks">{a.checks.map(check => <div key={check.label}><span>{check.label}</span><strong>{check.earned} / {check.required} {check.unit}</strong></div>)}</div>
    <h3 className="detail-subtitle">自由選択と科目群上限</h3><p className="muted">各区分の最低単位数を超える算入可能単位を自由選択に振り替え、同じ単位は合計に一度だけ加算します。他学科・教職・単位数不一致の科目は、修得済みに選んでも卒業算入を保留します。</p><ul className="plain-list">{rules.credit_caps_for_graduation.map(r => <li key={r.credit_family}>{r.title_family}：卒業算入は計{r.max_credits}単位まで。超過分は自由選択にも加算しません。</li>)}</ul>
    <h3 className="detail-subtitle">残る確認事項</h3><ul className="plain-list">{dataIssues.map((issue, i) => <li key={i}><strong>{ISSUE_LABELS[issue.kind] || issue.kind}</strong>{issue.kind === "handbook_subtotal_typo" && <p>専門基礎は提供JSONの採用値33単位を使用。要覧の一部に34単位という記載があり、大学の公式訂正を確認したものではありません。</p>}</li>)}</ul><p className="fine-print">在学月数・休学・進級認定、定員・抽選、許可、クラス割当、読み替え、留学や活動認定の全条件は自動判定しません。</p>
    <a className="button secondary full-width" href="https://www.asc.tcu.ac.jp/7580/" target="_blank" rel="noreferrer">公式時間表・訂正の案内<ExternalLink size={14} /></a></>;
}

export function Help() {
  return <><DataNotice compact /><p className="detail-description">東京都市大学メディア情報学部・社会メディア学科の2025年度入学者向けに、履修計画を整理する非公式サイトです。</p><ol className="help-steps"><li><span>1</span><div><h3>修得済み科目を登録</h3><p>修得科目は空の状態から始まります。区分別集計、必修、DS・MSなどの参考チェックに反映します。</p></div></li><li><span>2</span><div><h3>授業を検索・比較</h3><p>科目名・担当者・講義コードで検索し、評価方法と履修条件の原文、公式シラバスへのリンクを確認できます。</p></div></li><li><span>3</span><div><h3>前半・後半を分けて仮時間割へ</h3><p>詳細を開き、確認が必要な点を読んで仮置きします。異なる前半・後半の同時限は重複扱いにしません。</p></div></li></ol><div className="warning-banner"><TriangleAlert size={17} /><p>このサイトでの仮置きは正式な履修登録や履修許可ではありません。最新訂正と個人の履修条件は大学の案内で最終確認してください。</p></div><p className="muted">ゲストは入力を保存せず、ページを更新すると消去されます。アカウント利用は認証・保存先の接続後に使えます。時間割の自動作成は条件内の参考案を複数提案し、全組み合わせを網羅するものではありません。AI相談、画像・PDF読取、教員免許の全要件判定には未対応です。</p></>;
}
