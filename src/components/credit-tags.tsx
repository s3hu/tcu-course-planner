import type {Course} from "@/lib/data";
import {CREDIT_TAGS,creditCategoryLabel} from "@/lib/credit-tags";
export default function CreditTags({course,compact=false}:{course:Course;compact?:boolean}){
 return <span className="credit-tags" role="group" aria-label="単位区分タグ">{course.creditTagIds.filter(id=>!compact||["group","category","status"].includes(CREDIT_TAGS[id].kind)).map(id=>{const tag=CREDIT_TAGS[id];return <span key={id} className={"credit-tag credit-tag-"+tag.kind} style={{color:tag.color,borderColor:tag.color+"38",background:tag.color+"0d"}}>{tag.label}</span>;})}</span>;
}
export function CreditCategoryNote({course}:{course:Course}){return <p className="credit-category-note"><b>単位の区分</b>{creditCategoryLabel(course)}<small>教育課程表に基づく区分です。算入上限や超過分の自由選択への振替は、修得・予定の集計に反映します。</small></p>;}
