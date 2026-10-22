import {playerEfGPctFromTotals} from './playerStats.ts';

const per40=(p,key)=>p.minutes>0&&Number.isFinite(p[key])?40*p[key]/p.minutes:null;
const attempts=p=>p.twoPA+p.threePA;
const metrics=[
 {key:'assists',label:'Syöttöjä / 40 min',trait:'Pelinteko',unit:'AST / 40',value:p=>per40(p,'assists'),enough:p=>p.assists>=6,change:1.5},
 {key:'rebounds',label:'Levypalloja / 40 min',trait:'Levypallot',unit:'REB / 40',value:p=>per40(p,'rebounds'),enough:p=>p.rebounds>=10,change:2.5},
 {key:'steals',label:'Riistoja / 40 min',trait:'Riistot',unit:'STL / 40',value:p=>per40(p,'steals'),enough:p=>p.steals>=3,change:1},
 {key:'efg',label:'eFG %',trait:'Heittotehokkuus',unit:'%',value:playerEfGPctFromTotals,enough:p=>attempts(p)>=30,change:7},
];
const role={key:'minutes',label:'Peliaika / ottelu',trait:'Roolin muutos',unit:'MIN / O',value:p=>p.games>0?p.minutes/p.games:null,enough:()=>true,change:5};
const nameKey=name=>name.normalize('NFC').trim().toLocaleLowerCase('fi').replace(/\s+/g,' ');
function uniqueNames(players){const map=new Map();for(const p of players){const key=nameKey(p.name);map.set(key,map.has(key)?null:p);}return map;}
const order=(a,b)=>b.strength-a.strength||b.player.minutes-a.player.minutes||a.player.name.localeCompare(b.player.name,'fi');

export function discoveryQualification(players){
 const mostGames=Math.max(0,...players.map(p=>p.games));
 const games=Math.max(2,Math.ceil(mostGames/3));
 return {games,minutes:games*15,early:mostGames<8};
}
export function seasonOutliers(players,previous,limit=4){
 const qualification=discoveryQualification(players),byId=new Map(previous.map(p=>[p.id,p]));
 const oldNames=uniqueNames(previous),currentNames=uniqueNames(players),candidates=[];
 for(const player of players){
  if(player.games<qualification.games||!Number.isFinite(player.minutes)||player.minutes<qualification.minutes)continue;
  const key=nameKey(player.name),baseline=byId.get(player.id)||(currentNames.get(key)===player?oldNames.get(key):null);
  if(!baseline||baseline.games<8||!Number.isFinite(baseline.minutes)||baseline.minutes<120)continue;
  for(const metric of [...metrics.filter(m=>m.key!=='steals'),role]){
   if(!metric.enough(player)||!metric.enough(baseline)||metric.key==='efg'&&attempts(baseline)<80)continue;
   const current=metric.value(player),prior=metric.value(baseline);
   if(!Number.isFinite(current)||!Number.isFinite(prior))continue;
   const delta=current-prior;if(Math.abs(delta)<metric.change)continue;
   candidates.push({player,baseline,metric:metric.key,label:metric.label,trait:metric.trait,unit:metric.unit,current,prior,delta,direction:delta>0?'up':'down',teamChanged:player.team!==baseline.team,identity:byId.has(player.id)?'id':'name',strength:Math.abs(delta)/metric.change*Math.min(1,Math.sqrt(player.minutes/240))});
  }
 }
 // Keep both directions and different players; do not force an unqualified decline.
 const selected=[],ids=new Set();
 for(const direction of ['up','down']){
  for(const row of candidates.filter(c=>c.direction===direction).sort(order)){
   if(ids.has(row.player.id))continue;
   selected.push(row);ids.add(row.player.id);
   if(selected.filter(c=>c.direction===direction).length>=Math.ceil(limit/2))break;
  }
 }
 for(const row of candidates.sort(order))if(selected.length<limit&&!ids.has(row.player.id)){selected.push(row);ids.add(row.player.id);}
 return {rows:selected.slice(0,limit),qualification};
}

export function playersToWatch(players,limit=4){
 const qualification=discoveryQualification(players),candidates=[];
 const eligible=players.filter(p=>p.games>=qualification.games&&p.minutes>=qualification.minutes);
 for(const metric of metrics){
  const cohort=eligible.filter(p=>metric.enough(p)&&Number.isFinite(metric.value(p)));
  if(cohort.length<5)continue;
  const average=metric.key==='efg'?100*cohort.reduce((s,p)=>s+p.twoPM+1.5*p.threePM,0)/cohort.reduce((s,p)=>s+attempts(p),0):40*cohort.reduce((s,p)=>s+p[metric.key],0)/cohort.reduce((s,p)=>s+p.minutes,0);
  for(const player of cohort){
   const value=metric.value(player),rank=1+cohort.filter(p=>metric.value(p)>value).length;
   if(rank/cohort.length>.15)continue;
   candidates.push({player,metric:metric.key,label:metric.label,trait:metric.trait,unit:metric.unit,value,average,rank,cohort:cohort.length,strength:(1-rank/cohort.length)*Math.min(1,Math.sqrt(player.minutes/120))});
  }
 }
 const rows=[],ids=new Set();
 // One slot per strength makes the watchlist broader than a scoring leaderboard.
 for(const metric of metrics){
  const candidate=candidates.filter(c=>c.metric===metric.key&&!ids.has(c.player.id)).sort(order)[0];
  if(candidate){rows.push(candidate);ids.add(candidate.player.id);}
 }
 return {rows:rows.slice(0,limit),qualification};
}
