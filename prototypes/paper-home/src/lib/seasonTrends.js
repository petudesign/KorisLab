export const trendMetrics=[{key:'points',label:'Pisteet / ottelu',unit:'PTS'},{key:'net',label:'Nettotehokkuus',unit:'NET'},{key:'efg',label:'Heittojen tehokkuus',unit:'eFG %'},{key:'three',label:'Kolmosyritykset / ottelu',unit:'3PA'}];
const total=(rows,key)=>rows.every(t=>Number.isFinite(t.stats?.[key]))?rows.reduce((n,t)=>n+t.stats[key],0):null;
export function seasonTrend(games,teamName,metric){
 const rows=games.filter(g=>g.verified&&g.teams.length===2&&(!teamName||g.teams.some(t=>t.name===teamName))).sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id))).map(g=>{
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
  const selected=teamName?g.teams.filter(t=>t.name===teamName):g.teams;
  let numerator=null,denominator=null;
  if(metric==='points'){numerator=selected.reduce((n,t)=>n+t.score,0);denominator=selected.length;}
  if(metric==='three'){numerator=total(selected,'three_pa');denominator=selected.length;}
  if(metric==='efg'){const two=total(selected,'two_pm'),three=total(selected,'three_pm'),twoA=total(selected,'two_pa'),threeA=total(selected,'three_pa');if([two,three,twoA,threeA].every(Number.isFinite)){numerator=100*(two+1.5*three);denominator=twoA+threeA;}}
  if(metric==='net'){const attempts=total(g.teams,'two_pa'),threes=total(g.teams,'three_pa'),ft=total(g.teams,'fta'),orb=total(g.teams,'offensive_rebounds'),to=total(g.teams,'turnovers');if([attempts,threes,ft,orb,to].every(Number.isFinite)){denominator=(attempts+threes+.44*ft-orb+to)/2;numerator=teamName?100*(selected[0].score-g.teams.find(t=>t.name!==teamName).score):0;}}
  return {id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,numerator,denominator,value:Number.isFinite(numerator)&&denominator>0?numerator/denominator:null};
 });
 return rows.map((row,i)=>{const window=rows.slice(Math.max(0,i-4),i+1).filter(r=>Number.isFinite(r.value));const denominator=window.reduce((n,r)=>n+r.denominator,0);return {...row,window:window.length,rolling:denominator>0?window.reduce((n,r)=>n+r.numerator,0)/denominator:null};});
}
export function phaseValue(team,key){if(!team||!team.games)return null;if(key==='ortg')return team.metrics.offensive_rating;if(key==='drtg')return team.metrics.defensive_rating;if(key==='fg'){const s=team.totals,attempts=s.two_pa+s.three_pa;return attempts>0?100*(s.two_pm+s.three_pm)/attempts:null;}return Number.isFinite(team.totals[key])?team.totals[key]/team.games:null;}
