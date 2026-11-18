import type {Offering} from "./data";
import {overlaps} from "./rules";

export type RequiredGroup={courseId:string;current:boolean;choices:{offering:Offering;load:number}[]};
export type RequiredSeed={ids:string[];load:number;overdueCount:number};
export function selectRequiredSeeds(groups:RequiredGroup[],locked:Offering[],lockedLoad:number,target:number,visitLimit=50000){
 const ordered=[...groups].sort((a,b)=>Number(b.current)-Number(a.current)||a.choices.length-b.choices.length||a.courseId.localeCompare(b.courseId));
 const remaining=ordered.map((_,i)=>ordered.slice(i).filter(g=>!g.current).length);
 let visits=0,exhausted=false,bestCount=-1;
 let seeds:RequiredSeed[]=[];
 function visit(index:number,selected:Offering[],load:number,overdueCount:number){
   if(++visits>visitLimit){exhausted=true;return;}
   if(overdueCount+(remaining[index]??0)<bestCount)return;
   if(index===ordered.length){
     if(overdueCount>bestCount){bestCount=overdueCount;seeds=[];}
     if(overdueCount===bestCount){
       seeds.push({ids:selected.map(o=>o.id),load,overdueCount});
       // Current-year obligations are never pruned individually. Only complete mandatory seeds are bounded.
       if(seeds.length>128)seeds=seeds.sort((a,b)=>b.load-a.load||a.ids.join("|").localeCompare(b.ids.join("|"))).slice(0,64);
     }return;
   }
   const group=ordered[index];
   for(const {offering,load:extra} of group.choices){
     if(load+extra>target||selected.some(o=>o.courseId===offering.courseId||overlaps(o,offering)))continue;
     visit(index+1,[...selected,offering],load+extra,overdueCount+(group.current?0:1));
     if(exhausted)break;
   }
   // Overdue/repeat-required courses can conflict with each other. Every omission is audited in the result.
   if(!group.current&&!exhausted)visit(index+1,selected,load,overdueCount);
 }
 visit(0,locked,lockedLoad,0);
 const unique=new Map<string,RequiredSeed>();
 for(const seed of seeds){const key=[...seed.ids].sort().join("|");if(!unique.has(key))unique.set(key,seed);}
 return {seeds:[...unique.values()].slice(0,64),exhausted,visits,bestOverdueCount:bestCount};
}
