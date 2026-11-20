"use client";
import {useState} from "react";
import {ArrowUpRight,ArrowRight,GraduationCap,MapPin,SlidersHorizontal,Sparkles} from "lucide-react";

const layouts=[
 [{c:1,r:1,h:2,label:"LEARN",tone:"blue"},{c:3,r:1,h:1,label:"IDEA",tone:"sage"},{c:2,r:3,h:2,label:"EXPLORE",tone:"peach"},{c:5,r:2,h:2,label:"CREATE",tone:"yellow"},{c:4,r:4,h:1,label:"THINK",tone:"sage"}],
 [{c:1,r:1,h:2,label:"LEARN",tone:"blue"},{c:2,r:1,h:1,label:"IDEA",tone:"sage"},{c:1,r:3,h:2,label:"EXPLORE",tone:"peach"},{c:2,r:2,h:2,label:"CREATE",tone:"yellow"},{c:3,r:2,h:1,label:"THINK",tone:"sage"}],
 [{c:1,r:3,h:2,label:"LEARN",tone:"blue"},{c:3,r:3,h:1,label:"IDEA",tone:"sage"},{c:2,r:3,h:2,label:"EXPLORE",tone:"peach"},{c:5,r:3,h:2,label:"CREATE",tone:"yellow"},{c:4,r:4,h:1,label:"THINK",tone:"sage"}],
];
export default function Landing({onStart,onAccount,accountReady}:{onStart:()=>void;onAccount:()=>void;accountReady:boolean}){
 const [layout,setLayout]=useState(0);
 return <div className="landing-content">
 <section className="landing-hero" aria-labelledby="landing-title">
  <div className="hero-copy"><p className="micro-label"><span className="live-dot"/>FOR YOUR NEXT SEMESTER</p><h1 id="landing-title">学びにも、<br/>余白にも、<br/><span>自分らしさを。</span></h1><p className="hero-description">必要な単位も、通うキャンパスも。<br/>あなたの条件から、次の時間割を見つけよう。</p>
   <div className="entry-choices" id="entry-choices" role="group" aria-label="使い方を選ぶ" aria-describedby="entry-description" tabIndex={-1}>
    <div className="entry-actions">
     <button type="button" className="button primary" onClick={onStart}>ゲストで使用<ArrowRight size={16} aria-hidden="true"/></button>
     <button type="button" className="button secondary" onClick={onAccount}>登録する・ログイン<ArrowRight size={16} aria-hidden="true"/></button>
    </div>
    <div className="entry-description" id="entry-description">
     <p>{accountReady
      ? "ログインすると、対応する全学部・入学年度の修得科目やプランをアカウントに保存し、次回も使えます。"
      : "接続準備が整うと、ログインして対応する全学部・入学年度の修得科目やプランをアカウントに保存できるようになります。"}</p>
     <p>ゲストの入力は自動保存されません。</p>
    </div>
   </div>
  </div>
  <div className="hero-art"><div className="hero-orbit" aria-hidden="true"/><span className="art-note">A LITTLE MORE ROOM<br/>FOR POSSIBILITY.</span><div className="schedule-paper"><div className="paper-top"><span className="micro-label">YOUR WEEK, REIMAGINED</span><Sparkles size={18}/></div><div className="paper-title"><strong>My next semester.</strong><span>01 — 05</span></div><div className="paper-days">{["MON","TUE","WED","THU","FRI"].map(d=><span key={d}>{d}</span>)}</div><div className="paper-grid" key={layout} aria-hidden="true">{Array.from({length:25},(_,i)=><i className="paper-cell" key={i}/>)}{layouts[layout].map((b,i)=><div className={"paper-block "+b.tone} key={b.label} style={{gridColumn:b.c,gridRow:b.r+"/span "+b.h}}><small>{String(i+1).padStart(2,"0")}</small><strong>{b.label}</strong><ArrowUpRight size={12}/></div>)}</div><div className="paper-bottom"><span>Space to learn. Space to live.</span><span className="paper-dot"/></div></div><span className="free-sticker" aria-hidden="true">MAKE<br/><em>room.</em><ArrowUpRight size={26}/></span><div className="art-switcher"><span>時間割のイメージ</span><div role="group" aria-label="時間割イメージを切り替え">{["バランス","登校日をまとめる","朝に余白"].map((t,i)=><button key={t} aria-label={t+"のイメージ"} title={t} aria-pressed={layout===i} onClick={()=>setLayout(i)}>{String(i+1).padStart(2,"0")}</button>)}</div></div></div>
 </section>
 <div className="landing-scope"><span>TOKYO CITY UNIVERSITY / UNOFFICIAL</span><p>社会メディア学科は2022〜2026年度、情報システム学科・環境学部・デザイン・データ科学部は2023〜2026年度入学に対応 · 2026年度開講の収録分</p><span>2026 COURSE DATA <ArrowUpRight size={12}/></span></div>
 <section className="how-section" id="how-it-works"><div className="section-title-editorial"><span className="micro-label">HOW IT WORKS / 3 STEPS</span><h2>空きコマから見つけて、<br/>自分の時間割にしよう。</h2><p>単位区分とキャンパスを軸に、<br/>自分に合う学期のかたちを。</p></div><div className="feature-grid">
 <article><span className="feature-number">01</span><GraduationCap size={27} strokeWidth={1.3}/><h3>あなたの現在地を知る。</h3><p>入学年度・学部・学科を設定。修得科目を入れると、これから必要な単位区分が見えてきます。</p><span className="feature-tag">PROFILE & CREDITS</span></article>
 <article><span className="feature-number">02</span><MapPin size={27} strokeWidth={1.3}/><h3>通い方から、絞り込む。</h3><p>曜日・時限を押して、その時間に入る授業を確認。必修・単位区分・キャンパスから選べます。</p><span className="feature-tag">CAMPUS & CONDITIONS</span></article>
 <article><span className="feature-number">03</span><SlidersHorizontal size={27} strokeWidth={1.3}/><h3>比べて、しっくりくる案へ。</h3><p>同じ時間の授業を比べて仮置き。授業内容や評価方法、複数コマの予定も確認できます。</p><span className="feature-tag">COMPARE & REFINE</span></article>
 </div></section>
 </div>;
}