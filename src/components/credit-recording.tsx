import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORIES } from "@/lib/data";
import { customCreditKey, type CustomCompleted } from "@/lib/past-credits";
import type { UsageMode } from "./experience";

export function CreditRecordingAccess({ mode, onLogin, children }: {
  mode: UsageMode;
  onLogin: () => void;
  children: ReactNode;
}) {
  if (mode === "account") return <>{children}</>;
  return <div className="past-credit-stack">
    <p>ログインすると、修得科目の記録と要件の管理が使えます</p>
    <button type="button" className="button secondary" onClick={onLogin}>ログインへ進む</button>
  </div>;
}

export function CreditRecordingActions({ onImport, onCustom }: {
  onImport: () => void;
  onCustom?: () => void;
}) {
  return <div className="past-credit-actions">
    <button type="button" className="button primary" onClick={onImport}>まとめて記録する</button>
    {onCustom && <button type="button" className="button secondary" onClick={onCustom}>カタログ外の科目を入力</button>}
  </div>;
}

export function CustomCompletedList({ credits, onEdit, onRemove }: {
  credits: readonly CustomCompleted[];
  onEdit?: (credit: CustomCompleted) => void;
  onRemove: (credit: CustomCompleted) => void;
}) {
  if (!credits.length) return null;
  return <div className="handbook-plan-list">
    <h3>自由入力の科目（{credits.length}件）</h3>
    {credits.map(credit => <div key={customCreditKey(credit)}>
      <div><strong>{credit.name}</strong><p>{CATEGORIES[credit.category].label} · {credit.credits}単位
        {!!credit.satisfiesCourseIds?.length && ` · 認定・免除 ${credit.satisfiesCourseIds.length}科目`}</p></div>
      <div className="past-credit-actions">
        {onEdit && <button type="button" className="icon-button" aria-label={credit.name + "を編集"} onClick={() => onEdit(credit)}>
          <Pencil size={16}/>
        </button>}
        <button type="button" className="icon-button" aria-label={credit.name + "を削除"} onClick={() => onRemove(credit)}>
          <Trash2 size={16}/>
        </button>
      </div>
    </div>)}
  </div>;
}
