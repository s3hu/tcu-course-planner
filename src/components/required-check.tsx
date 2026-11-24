import {Check,TriangleAlert} from "lucide-react";
import type {RequiredAudit} from "@/lib/scheduling";
const labels:Record<RequiredAudit["status"],string>={completed:"充足済み",future:"将来年次",other_term:"別学期・開講情報なし",unavailable:"開講データ未確認",scheduled:"この案に含む",ready:"未採用",blocked:"条件の確認が必要"};
export default function RequiredCheck({items}:{items:RequiredAudit[]}){
 const current=items.filter(a=>a.current&&a.status!=="completed"),included=current.filter(a=>a.status==="scheduled");
 const missing=items.filter(a=>!["completed","scheduled","future","other_term"].includes(a.status));
 return <div className="required-check"><p className={"required-coverage "+(included.length<current.length?"incomplete":"")} >{included.length<current.length?<TriangleAlert size={14}/>:<Check size={14}/>}{current.length?<>今期・当該年次の必修 <strong>{included.length}/{current.length}科目</strong>を含む</>:"今期・当該年次の未修得必修なし（入力ベース）"}</p>{missing.length>0&&<section className="required-missing"><strong><TriangleAlert size={13}/>未修得必修に未解決 {missing.length}科目</strong><ul>{missing.map(a=><li key={a.courseId}><b>{a.name}</b><span>{a.reasons.join("／")}</span></li>)}</ul><p>この案だけでは、未修得の必修をすべて解消できません。</p></section>}<details className="required-audit"><summary>必修全{items.length}科目のチェック</summary><ul>{items.map(a=><li key={a.courseId}><div><strong>{a.name}</strong><span className={"audit-status "+a.status}>{labels[a.status]}</span></div><small>{a.reasons.join("／")}</small></li>)}</ul></details></div>;
}
