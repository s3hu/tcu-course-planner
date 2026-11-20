"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Cloud, GraduationCap, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import Planner from "./planner";
import HandbookPlanner from "./handbook-planner";
import {HANDBOOK_FACULTIES,handbookDepartments,SUPPORTED_YEARS,supportsHandbookProfile} from "@/lib/handbooks";
import Landing from "./landing";
import RegistrationGuide from "./registration-guide";
import SiteFooter from "./site-footer";
import { DEFAULT_STATE, type PlannerState, type Profile } from "@/lib/data";
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
    const state={...structuredClone(DEFAULT_STATE),profile};setInitial(state);setStep("planner");setMessage("");if(mode==="account"&&applicable(profile))persist(state);else setStatus("guest");
  }
  async function flush(){if(saveTimer.current){clearTimeout(saveTimer.current);saveTimer.current=null;}if(pending.current){const latest=pending.current;pending.current=null;persist(latest);}await saveQueue.current;return !savePaused.current;}
  async function exit(){if(mode==="account"&&!await flush()&&!window.confirm("未保存の入力が残っています。必要ならキャンセルしてプランを書き出してください。保存せず入口に戻りますか？"))return;setStep("welcome");setInitial(structuredClone(DEFAULT_STATE));setMessage("");setAdmission("");setFaculty("");setDepartment("");}
  async function signOut(){if(!await flush()&&!window.confirm("未保存の入力が残っています。必要ならキャンセルしてプランを書き出してください。保存せずログアウトしますか？"))return;const client=await getCloudClient();const {error}=await client.auth.signOut();if(error){setMessage("ログアウトできませんでした。接続を確認して再試行してください。");return;}savePaused.current=false;userId.current=null;revision.current=null;setEmail("");setStatus("guest");await exit();}
  async function chooseHandbookProfile(profile:Profile){
    if(mode==="account"&&!await flush()&&!window.confirm("未保存の入力が残っています。所属選択に戻りますか？"))return;
    setAdmission(String(profile.admissionYear));setFaculty(profile.faculty);setDepartment(profile.department);setTerm(profile.term);
    setMode("guest");setStatus("guest");setMessage("");setStep("profile");window.scrollTo({top:0});
  }
  if(step==="planner"&&supportsHandbookProfile(initial.profile))return <HandbookPlanner key={[initial.profile.faculty,initial.profile.department,initial.profile.admissionYear].join(":")} profile={initial.profile} onExit={()=>setStep("profile")}/>;
  if(step==="planner")return <Planner initialState={initial} usageMode={mode} onStateChange={changed} saveStatus={status} saveMessage={message} accountEmail={email} onExit={()=>void exit()} onChooseHandbookProfile={profile=>void chooseHandbookProfile(profile)} onSignOut={()=>void signOut()}/>;
  const selectedProfile:Profile={admissionYear:Number(admission),faculty,department,academicYear:2026,term};
  const supported=!!admission&&!!faculty&&!!department&&supportedProfile(selectedProfile);
  const departments = handbookDepartments(faculty);
  const yearSupported = (year:number) => {
    const candidates = department ? [department] : departments;
    return faculty ? candidates.some(name => supportedProfile({...selectedProfile,admissionYear:year,department:name})) : SUPPORTED_YEARS.includes(year);
  };
  return <div className={"welcome-shell step-"+step}><header className="welcome-header"><button className="brand" onClick={()=>setStep("welcome")}><span className="brand-mark"><BookOpen size={23}/></span><span>履修ノート<small>YOUR NEXT SEMESTER</small></span></button><nav className="welcome-nav" aria-label="サイト案内">{step==="welcome"&&<a href="#how-it-works">使い方</a>}<span>TCU / UNOFFICIAL</span>{step==="welcome"?<a className="welcome-start" href="#entry-choices">はじめる<ArrowRight size={15}/></a>:<button className="welcome-start" onClick={startGuest}>はじめる<ArrowRight size={15}/></button>}</nav></header>
    <main className="welcome-main">{step!=="welcome"&&<button className="text-button back-link" onClick={()=>{setStep("welcome");setMessage("");}}><ArrowLeft size={15}/>使い方を選び直す</button>}
    {step==="welcome"&&<Landing onStart={startGuest} onAccount={()=>void chooseAccount()} accountReady={cloudConfigured}/>}
    {step==="login"&&<section className="onboarding-panel">
      {cloudConfigured ? <>
        <span className="mode-icon"><LockKeyhole size={25}/></span>
        <h1>{register?"アカウントをつくる":"ログイン"}</h1>
        <p className="muted">このサイト用のメールアドレスとパスワードを使います。大学のログイン情報は入力しないでください。</p>
        <form onSubmit={e=>void submitAuth(e)}><label className="form-field">メールアドレス<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="form-field">パスワード<input type="password" required minLength={8} autoComplete={register?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary full-width" disabled={busy}>{busy?"確認中…":register?"確認メールを送って登録":"ログイン"}</button><button type="button" className="text-button full-width" onClick={()=>{setRegister(!register);setMessage("");}}>{register?"アカウントをお持ちの方はログイン":"はじめての方は新規登録"}</button></form>
      </> : <>
        <span className="mode-icon"><Cloud size={25}/></span>
        <h1>アカウント保存は接続準備中です</h1>
        <div className="setup-notice">
          <p>接続準備が整うと登録・ログインが利用できます。現在はゲストで時間割を作成できます。</p>
        </div>
        <button type="button" className="button primary full-width" onClick={startGuest}>ゲストで使用<ArrowRight size={15}/></button>
      </>}
      {message&&<p role="status" className="auth-message">{message}</p>}
    </section>}
    {step==="profile"&&<section className="onboarding-panel"><span className="step-number">STEP 01 · ABOUT YOU</span><h1>まず、あなたの所属を教えてください。</h1><p className="muted">適用する履修要件を、入学年度と学部・学科から確認します。</p><form onSubmit={begin}><label className="form-field">入学年度<select required value={admission} onChange={e=>setAdmission(e.target.value)}><option value="">選択してください</option>{[2026,2025,2024,2023,2022,2021,2020].map(y=><option key={y} value={y}>{y}年度入学{yearSupported(y)?"（要覧データあり）":"（データ未対応）"}</option>)}</select></label><label className="form-field">学部<select required value={faculty} onChange={e=>{setFaculty(e.target.value);setDepartment("");}}><option value="">選択してください</option>{HANDBOOK_FACULTIES.map(name=><option key={name}>{name}</option>)}</select></label><label className="form-field">学科<select required disabled={!faculty} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">選択してください</option>{departments.map(name=><option key={name}>{name}</option>)}</select></label><label className="form-field">計画する学期<select value={term} onChange={e=>setTerm(e.target.value as "前期"|"後期")}><option value="後期">2026年度 後期</option><option value="前期">2026年度 前期</option></select></label>{admission&&yearSupported(Number(admission))&&<p className="cohort-preview"><strong>{admission}年度入学の学修要覧を使います</strong><br/>入学年度ごとに科目・区分・要件を分けて集計します。時間割は2026年度開講の収録分から参照します。</p>}<p className="scope-note">社会メディア学科は2022〜2026年度、情報システム学科・環境学部・デザイン・データ科学部は2023〜2026年度入学に対応します。学修要覧モードの時間割には照合できた収録クラスが表示されます。</p>{admission&&!yearSupported(Number(admission))&&<p className="auth-message" role="status">この入学年度・学部・学科の組み合わせはデータ未対応です。</p>}<button className="button primary full-width" disabled={!supported}><Check size={16}/>この条件で時間割を考える<ArrowRight size={15}/></button></form>{applicable(selectedProfile)&&<RegistrationGuide/>}<p className="privacy-line">{mode==="guest"?"ゲスト利用：この入力を端末やサーバーに保存しません。":supportsHandbookProfile(selectedProfile)?"学修要覧モードのプランはファイルに書き出せます。":"アカウント利用：修得科目と計画を自分のアカウントに保存します。"}</p></section>}
    </main>{step==="welcome"?<SiteFooter startHref="#entry-choices"/>:<p className="welcome-footer">履修ノート · 東京都市大学向けの非公式サービス。正式登録は大学のシステムで行ってください。</p>}</div>;
}
