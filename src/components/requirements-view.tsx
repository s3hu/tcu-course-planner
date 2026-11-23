import { CATEGORIES, courseById, requirement, rules, type PlannerState } from "@/lib/data";
import { progressionSummary } from "@/lib/requirements";
import type { CreditSummary } from "@/lib/rules";

const format = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 8 });

function minimum(earned: number, required: number, unit: string) {
  return `${format.format(earned)} / ${required} ${unit}（${earned >= required ? "充足" : `あと ${format.format(required - earned)} ${unit}`}）`;
}

export default function RequirementsView({ state, earned, projected }: {
  state: PlannerState; earned: CreditSummary; projected: CreditSummary;
}) {
  const { months, limits, midyearProgressionAllowed, checks } = progressionSummary(state, new Date(), earned);
  const creditRows = [
    { label: "卒業算入の総単位", earned: earned.total, projected: projected.total, required: requirement.total, unit: "単位" },
    ...earned.breakdown.map((row, index) => ({
      label: CATEGORIES[row.id].label, earned: row.earned, projected: projected.breakdown[index].earned, required: row.required, unit: "単位",
    })),
    ...earned.checks.map((row, index) => ({ ...row, projected: projected.checks[index].earned })),
  ];

  return <div className="past-credit-stack">
    <p className="warning-banner">学修要覧に基づく参考表示です。大学の公式な卒業・進級判定ではありません。</p>
    <section className="panel requirements-panel past-credit-stack">
      <h2>卒業要件</h2>
      <div className="requirements-table">
        <table>
          <thead><tr><th scope="col">要件</th><th scope="col">修得</th><th scope="col">今期の仮置き込み</th></tr></thead>
          <tbody>
            {creditRows.map(row => <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{minimum(row.earned, row.required, row.unit)}</td>
              <td>{minimum(row.projected, row.required, row.unit)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="fine-print">区分最低を超えた算入単位は自由選択へ一度だけ振り替えます。</p>
      <h3>必修科目</h3>
      <p>修得 {requirement.mandatoryIds.length - earned.missingRequired.length} / {requirement.mandatoryIds.length} 科目 · 仮置き込みで残り {projected.missingRequired.length} 科目</p>
      {earned.missingRequired.length > 0 && <ul className="requirements-missing">{earned.missingRequired.map(id =>
        <li key={id}>{courseById.get(id)?.name ?? id}（{projected.missingRequired.includes(id) ? "未修得" : "仮置き済み"}）</li>
      )}</ul>}
      <h3>科目群ごとの卒業算入上限</h3>
      <div className="requirements-table">
        <table>
          <thead><tr><th scope="col">科目群</th><th scope="col">修得</th><th scope="col">今期の仮置き込み</th></tr></thead>
          <tbody>{earned.caps.map((cap, index) => <tr key={cap.label}>
            <th scope="row">{cap.label}（上限 {cap.maximum} 単位）</th>
            <td>{cap.counted} 単位算入 · {cap.excess} 単位超過</td>
            <td>{projected.caps[index].counted} 単位算入 · {projected.caps[index].excess} 単位超過</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p>算入保留は修得 {earned.pending.length} 科目、仮置き込み {projected.pending.length} 科目。卒業非算入は修得 {earned.excluded.length} 科目、仮置き込み {projected.excluded.length} 科目です。</p>
      <p className="fine-print">学外修得単位の認定は合算で上限 {rules.external_credit_recognition_limit.maximum_combined_credits} 単位です。認定や自由入力科目の実際の算入区分・上限は大学で確認してください。</p>
    </section>
    <section className="panel requirements-panel past-credit-stack">
      <h2>進級・着手条件</h2>
      <p>卒業算入の修得単位 {format.format(earned.total)} 単位 · 在学期間 約 {months} か月</p>
      {checks.map(check => <div key={check.label} className="requirement-condition">
        <h3>{check.label} · {check.met ? "条件充足の目安" : "未充足の目安"}</h3>
        <p>卒業算入 {minimum(earned.total, check.creditsRequired, "単位")} · 在学 {minimum(months, check.monthsRequired, "か月")}</p>
        {check.prerequisites.length > 0 &&
          <p>前提科目 {check.prerequisites.map(id => `${courseById.get(id)?.name ?? id}（${check.missing.includes(id) ? "未修得" : "修得済み"}）`).join("・")}</p>}
      </div>)}
      <p className="fine-print">{!midyearProgressionAllowed && "年度途中の3年次進級はありません。"}在学期間は入学年度の4月から現在の月（日本時間）までの概算です。休学がある場合は実際の在学期間とずれます。</p>
      <h3>在学期間の基準（参考）</h3>
      <ul className="requirements-missing">
        <li>卒業に必要な在学期間 {minimum(months, rules.minimum_enrollment_months, "か月")}</li>
        <li>2年次までの在学上限 {limits.maximum_enrolled_months_through_year_2_excluding_leave} か月（休学を除く）</li>
        <li>全体の在学上限 {limits.maximum_total_enrolled_months_excluding_leave} か月（休学を除く）</li>
      </ul>
    </section>
  </div>;
}
