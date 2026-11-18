"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Cloud, GraduationCap, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import Planner from "./planner";
import HandbookPlanner from "./handbook-planner";
import {SUPPORTED_YEARS,supportsHandbookProfile} from "@/lib/handbooks";
import Landing from "./landing";
import RegistrationGuide from "./registration-guide";
import SiteFooter from "./site-footer";
import { DEFAULT_STATE, requirement, type PlannerState, type Profile } from "@/lib/data";
import { applicable } from "@/lib/rules";
import { cloudConfigured, getCloudClient, readCloudPlan, writeCloudPlan } from "@/lib/cloud";

export type UsageMode="guest"|"account";
export type SaveStatus="guest"|"saved"|"saving"|"error";
type Step="welcome"|"login"|"profile"|"planner";
const supportedProfile=(profile:Profile)=>applicable(profile)||supportsHandbookProfile(profile);
export default function Experience(){
  const [step,setStep]=useState<Step>("welcome"),[mode,setMode]=useState<UsageMode>("guest");
  const [initial,setInitial]=useState<PlannerState>(()=>structuredClone(DEFAULT_STATE));
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [status,setStatus]=useState<SaveStatus>("guest");
  const [admission,setAdmission]=useState(""),[faculty,setFaculty]=useState(""),[department,setDepartment]=useState(""),[term,setTerm]=useState<"前期"|"後期">("後期");
  const userId=useRef<string|null>(null),revision=useRef<number|null>(null),saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null),saveQueue=useRef<Promise<void>>(Promise.resolve()),savePaused=useRef(false),active=useRef(true),pending=useRef<PlannerState|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;if(saveTimer.current)clearTimeout(saveTimer.current);};},[]);
  const persist=useCallback((state:PlannerState)=>{
    if(!userId.current||savePaused.current)return;
    setStatus("saving");
    saveQueue.current=saveQueue.current.then(async()=>{if(savePaused.current||!userId.current)return;try{revision.current=await writeCloudPlan(userId.current,state,revision.current);if(active.current&&!pending.current)setStatus("saved");}catch(e){savePaused.current=true;if(active.current){setStatus("error");setMessage(e instanceof Error?e.message:"保存に失敗しました。");}}});
  },[]);
  const changed=useCallback((state:PlannerState)=>{
    if(mode==="guest")return;if(savePaused.current){setStatus("error");return;}
    if(saveTimer.current)clearTimeout(saveTimer.current);
    pending.current=state;setStatus("saving");saveTimer.current=setTimeout(()=>{saveTimer.current=null;pending.current=null;persist(state);},900);
  },[mode,persist]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(status==="saving"){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[status]);
  async function openAccount(id:string,userEmail?:string){
    const saved=await readCloudPlan(id);userId.current=id;revision.current=saved?.revision??null;savePaused.current=false;setMode("account");setEmail(userEmail??email);setPassword("");setMessage("");setStatus("saved");
    if(saved){setInitial(saved.state);setStep("planner");}else{setInitial(structuredClone(DEFAULT_STATE));setStep("profile");}
  }
  function startGuest(){setMode("guest");setStatus("guest");setStep("profile");setMessage("");window.scrollTo({top:0});}
  async function chooseAccount(){
    window.scrollTo({top:0});
    setStep("login");setMessage("");if(!cloudConfigured)return;setBusy(true);
    try{const client=await getCloudClient();const {data}=await client.auth.getUser();if(data.user)await openAccount(data.user.id,data.user.email);}catch(e){setMessage(e instanceof Error?e.message:"ログインを確認できませんでした。");}finally{setBusy(false);}
  }
  async function submitAuth(e:FormEvent){e.preventDefault();if(!cloudConfigured||busy)return;setBusy(true);setMessage("");
    try{const client=await getCloudClient();if(register){const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw new Error("登録できませんでした。メールアドレス・パスワード・接続設定を確認してください。");if(data.session&&data.user)await openAccount(data.user.id,data.user.email);else{setMessage("確認メールを送りました。メール内のリンクを開いてから、ログインしてください。");setRegister(false);setPassword("");}}else{const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user)throw new Error("ログインできませんでした。入力内容とメール確認の完了を確認してください。");await openAccount(data.user.id,data.user.email);}}catch(e){setMessage(e instanceof Error?e.message:"接続できませんでした。");}finally{setBusy(false);}
  }
  function begin(e:FormEvent){e.preventDefault();const profile:Profile={admissionYear:Number(admission),faculty,department,academicYear:2026,term};if(!supportedProfile(profile))return;
    const state={...structuredClone(DEFAULT_STATE),profile};setInitial(state);setStep("planner");setMessage("");if(mode==="account"&&profile.admissionYear===2025)persist(state);else setStatus("guest");
  }
  async function flush(){if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}if(pending.current){const latest=pending.current;pending.current=null;persist(latest);}await saveQueue.current;return !savePaused.current;}
  async function exit(){if(mode==="account"&&!await flush()&&!window.confirm("未保存の入力が残っています。必要ならキャンセルしてプランを書き出してください。保存せず入口に戻りますか？"))return;setStep("welcome");setInitial(structuredClone(DEFAULT_STATE));setMessage("");setAdmission("");setFaculty("");setDepartment("");}
  async function signOut(){if(!await flush()&&!window.confirm("未保存の入力が残っています。必要ならキャンセルしてプランを書き出してください。保存せずログアウトしますか？"))return;const client=await getCloudClient();const {error}=await client.auth.signOut();if(error){setMessage("ログアウトできませんでした。接続を確認して再試行してください。");return;}savePaused.current=false;userId.current=null;revision.current=null;setEmail("");setStatus("guest");await exit();}
  if(step==="planner"&&initial.profile.admissionYear!==2025)return <HandbookPlanner key={initial.profile.admissionYear} profile={initial.profile} onExit={()=>setStep("profile")}/>;
  if(step==="planner")return <Planner initialState={initial} usageMode={mode} onStateChange={changed} saveStatus={status} saveMessage={message} accountEmail={email} onExit={()=>void exit()} onSignOut={()=>void signOut()}/>;
  const supported=!!admission&&!!faculty&&!!department&&supportedProfile({admissionYear:Number(admission),faculty,department,academicYear:2026,term});
  return <div className={"welcome-shell step-"+step}><header className="welcome-header"><button className="brand" onClick={()=>setStep("welcome")}><span className="brand-mark"><BookOpen size={23}/></span><span>履修ノート<small>YOUR NEXT SEMESTER</small></span></button><nav className="welcome-nav" aria-label="サイト案内">{step==="welcome"&&<a href="#how-it-works">使い方</a>}<span>TCU / UNOFFICIAL</span><button onClick={startGuest}>はじめる<ArrowRight size={15}/></button></nav></header>
    <main className="welcome-main">{step!=="welcome"&&<button className="text-button back-link" onClick={()=>{setStep("welcome");setMessage("");}}><ArrowLeft size={15}/>使い方を選び直す</button>}
    {step==="welcome"&&<Landing onStart={startGuest} onAccount={()=>void chooseAccount()} accountReady={cloudConfigured}/>}
    {step==="login"&&<section className="onboarding-panel"><span className="mode-icon"><LockKeyhole size={25}/></span><h1>{register?"アカウントをつくる":"保存したプランから、続けよう。"}</h1><p className="muted">このサイト用のメールアドレスとパスワードを使います。大学のログイン情報は入力しないでください。</p>{!cloudConfigured?<><div className="setup-notice"><Cloud size={20}/><div><h3>アカウント保存は接続準備中です</h3><p>認証と保存先の設定が終わると使えます。今はログイン不要で、時間割作成を試せます。</p></div></div><button className="button primary full-width" onClick={()=>{setMode("guest");setStatus("guest");setStep("profile");}}>保存せずに使ってみる<ArrowRight size={15}/></button></>:<form onSubmit={e=>void submitAuth(e)}><label className="form-field">メールアドレス<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="form-field">パスワード<input type="password" required minLength={8} autoComplete={register?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary full-width" disabled={busy}>{busy?"確認中…":register?"確認メールを送って登録":"ログイン"}</button><button type="button" className="text-button full-width" onClick={()=>{setRegister(!register);setMessage("");}}>{register?"アカウントをお持ちの方はログイン":"はじめての方は新規登録"}</button></form>}{message&&<p role="status" className="auth-message">{message}</p>}</section>}
    {step==="profile"&&<section className="onboarding-panel"><span className="step-number">STEP 01 · ABOUT YOU</span><h1>まず、あなたの所属を教えてください。</h1><p className="muted">適用する履修要件を、入学年度と学部・学科から確認します。</p><form onSubmit={begin}><label className="form-field">入学年度<select required value={admission} onChange={e=>setAdmission(e.target.value)}><option value="">選択してください</option>{[2026,2025,2024,2023,2022,2021,2020].map(y=><option key={y} value={y}>{y}年度入学{SUPPORTED_YEARS.includes(y)?"（要覧データあり）":"（データ未対応）"}</option>)}</select></label><label className="form-field">学部<select required value={faculty} onChange={e=>{setFaculty(e.target.value);setDepartment("");}}><option value="">選択してください</option><option>{requirement.faculty}</option></select></label><label className="form-field">学科<select required disabled={!faculty} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">選択してください</option><option>{requirement.department}</option></select></label><label className="form-field">計画する学期<select value={term} onChange={e=>setTerm(e.target.value as "前期"|"後期")}><option value="後期">2026年度 後期</option><option value="前期">2026年度 前期</option></select></label>{admission&&<p className="cohort-preview"><strong>{SUPPORTED_YEARS.includes(Number(admission))?admission+"年度入学の学修要覧を使います":"この入学年度は対応資料がありません"}</strong><br/>入学年度ごとに科目・区分・要件を分けて集計します。時間割は2026年度開講の収録分から参照します。</p>}<p className="scope-note">対応範囲：2022〜2026年度入学・メディア情報学部 社会メディア学科。追加年度の時間割は対象入学年度・科目名・単位数が一致した収録クラスのみを参考表示します。</p>{admission&&!SUPPORTED_YEARS.includes(Number(admission))&&<p className="auth-message">この入学年度の資料は未対応です。対応範囲の入学年度を選んでください。</p>}<button className="button primary full-width" disabled={!supported}><Check size={16}/>この条件で時間割を考える<ArrowRight size={15}/></button></form>{admission==="2025"&&<RegistrationGuide/>}<p className="privacy-line">{mode==="guest"?"ゲスト利用：この入力を端末やサーバーに保存しません。":"アカウント利用：修得科目と計画を自分のアカウントに保存します。"}</p></section>}
    </main>{step==="welcome"?<SiteFooter onStart={startGuest}/>:<p className="welcome-footer">履修ノート · 東京都市大学向けの非公式サービス。正式登録は大学のシステムで行ってください。</p>}</div>;
}
