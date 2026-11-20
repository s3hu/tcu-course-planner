import { Check } from "lucide-react";
import type { Profile } from "@/lib/data";
import { TERM_HALVES, type TermHalf } from "@/lib/term-halves";

export default function TermHalfFilter({
  term, selected, onChange,
}: {
  term: Profile["term"];
  selected: TermHalf[];
  onChange: (halves: TermHalf[]) => void;
}) {
  return (
    <fieldset>
      <legend>対象ターム</legend>
      <div className="chip-group">
        {TERM_HALVES.map(({ value, label }) => {
          const active = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`choice-chip ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(active ? selected.filter(half => half !== value) : [...selected, value])}
            >
              {active && <Check size={13} />}
              {label}
            </button>
          );
        })}
      </div>
      <p className="fine-print">対象学期は{term}です。未選択または両方を選ぶと、学期全体が対象になります。</p>
    </fieldset>
  );
}
