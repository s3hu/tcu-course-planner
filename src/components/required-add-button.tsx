"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { RequiredAdditions } from "@/lib/required-additions";

export default function RequiredAddButton({
  planned, addRequired, onPlanChange,
}: {
  planned: string[];
  addRequired: () => RequiredAdditions;
  onPlanChange: (planned: string[]) => void;
}) {
  const [result, setResult] = useState<RequiredAdditions | null>(null);
  const canUndo = result && result.added.length > 0 && result.planned === planned;

  function add() {
    const next = addRequired();
    if (next.added.length) onPlanChange(next.planned);
    setResult(next);
  }

  function undo() {
    if (!result || !canUndo) return;
    onPlanChange(planned.filter(id => !result.added.includes(id)));
    setResult(null);
  }

  return (
    <div className="required-add">
      <button type="button" className="button primary" onClick={add}>
        <Plus size={16} />必修を自動で追加
      </button>
      <div role="status">
        {result && <p>必修を<strong>{result.added.length}件</strong>追加しました。追加できなかった必修は<strong>{result.skipped.length}件</strong>です。</p>}
      </div>
      {canUndo && <button type="button" className="text-button" onClick={undo}>一括追加を元に戻す</button>}
      {!!result?.skipped.length && (
        <details>
          <summary>追加できなかった理由を見る</summary>
          <ul>
            {result.skipped.map(({ courseId, name, reasons }) => (
              <li key={courseId}><strong>{name}</strong>　{reasons.join("／")}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
