import { Check } from "lucide-react";
import { availableCreditFilterTags, CREDIT_FILTER_GROUPS, CREDIT_TAGS } from "@/lib/credit-tags";
import type { Course } from "@/lib/data";

export default function CreditTagFilter({ courses, selectedIds, onChange }: {
  courses: readonly Pick<Course, "creditTagIds">[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const available = availableCreditFilterTags(courses);
  if (!available.length) return null;

  return <fieldset>
    <legend>単位の区分で絞り込み</legend>
    <p className="fine-print">選んだ区分のいずれかに当てはまる科目を表示します。未選択ならすべての区分が対象です。</p>
    {CREDIT_FILTER_GROUPS.map(({ kind, label }) => {
      const tags = available.filter(id => CREDIT_TAGS[id].kind === kind);
      if (!tags.length) return null;
      return <div key={kind} role="group" aria-label={label}>
        <p className="fine-print">{label}</p>
        <div className="chip-group">{tags.map(id => {
          const selected = selectedIds.includes(id);
          return <button key={id} type="button" aria-pressed={selected}
            className={`choice-chip ${selected ? "active" : ""}`}
            onClick={() => onChange(selected ? selectedIds.filter(value => value !== id) : [...selectedIds, id])}>
            {selected && <Check size={13} />}{CREDIT_TAGS[id].label}
          </button>;
        })}</div>
      </div>;
    })}
  </fieldset>;
}
