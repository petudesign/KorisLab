// Players who play alike. Compares the shape of a player's game, not how good they are, so a reserve can sit next to a star.
// Leagues are compared separately. Seasons mix, and the season stays beside the name.
export const SIMILAR_MIN_GAMES=4,SIMILAR_MIN_MINUTES=100,SIMILAR_MIN_LOCATED=20,SIMILAR_KEPT=8;
export const SIMILAR_FEATURES=['three','rim','usage','assists','rebounds','freeThrows'];
const CLOSE=.6,MARKED=.5,REASONS=2;
const round=value=>Math.round(value*10)/10;
function spread(rows){
 const scale={};
 for(const key of SIMILAR_FEATURES){
  const values=rows.map(row=>row.values[key]),mean=values.reduce((sum,v)=>sum+v,0)/values.length;
  scale[key]={mean,sd:Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/values.length)||1};
 }
 return scale;
}
const standard=(row,scale)=>Object.fromEntries(SIMILAR_FEATURES.map(key=>[key,(row.values[key]-scale[key].mean)/scale[key].sd]));
const distance=(a,b)=>Math.sqrt(SIMILAR_FEATURES.reduce((sum,key)=>sum+(a[key]-b[key])**2,0));
// The reason is read from the same standardised numbers as the distance: traits both share, the most unusual first.
export function similarityReasons(a,b){
 const marked=SIMILAR_FEATURES.filter(key=>Math.sign(a[key])===Math.sign(b[key])&&Math.abs(a[key])>=MARKED&&Math.abs(b[key])>=MARKED&&Math.abs(a[key]-b[key])<=CLOSE)
  .sort((x,y)=>Math.abs(b[y]+a[y])-Math.abs(b[x]+a[x])).slice(0,REASONS).map(key=>({key,level:a[key]>0?'high':'low'}));
 if(marked.length)return marked;
 return [...SIMILAR_FEATURES].sort((x,y)=>Math.abs(a[x]-b[x])-Math.abs(a[y]-b[y])).slice(0,REASONS).map(key=>({key,level:'same'}));
}
export function buildSimilar(rows){
 if(!rows.length)return [];
 const scale=spread(rows),scores=rows.map(row=>standard(row,scale));
 return rows.map((row,index)=>{
  const best=new Map();
  rows.forEach((other,otherIndex)=>{
   if(other.id===row.id)return;
   const away=distance(scores[index],scores[otherIndex]),seen=best.get(other.id);
   if(!seen||away<seen.away)best.set(other.id,{index:otherIndex,away});
  });
  const similar=[...best.values()].sort((x,y)=>x.away-y.away||rows[x.index].name.localeCompare(rows[y.index].name,'fi')).slice(0,SIMILAR_KEPT)
   .map(({index:otherIndex})=>({at:otherIndex,reasons:similarityReasons(scores[index],scores[otherIndex])}));
  return {...row,values:Object.fromEntries(SIMILAR_FEATURES.map(key=>[key,round(row.values[key])])),similar};
 });
}
const TRAITS={
 three:{high:{fi:'paljon kolmosia',en:'many threes'},low:{fi:'vähän kolmosia',en:'few threes'},same:{fi:'lähes sama kolmosten osuus',en:'nearly the same share of threes'},unit:'%'},
 rim:{high:{fi:'paljon heittoja korin alta',en:'many shots at the rim'},low:{fi:'vähän heittoja korin alta',en:'few shots at the rim'},same:{fi:'lähes sama osuus korin alta',en:'nearly the same share at the rim'},unit:'%'},
 usage:{high:{fi:'paljon hyökkäysvastuuta',en:'a big offensive role'},low:{fi:'vähän hyökkäysvastuuta',en:'a small offensive role'},same:{fi:'lähes sama käyttöaste',en:'nearly the same usage'},unit:'%'},
 assists:{high:{fi:'iso osuus joukkueen syötöistä',en:'a large share of team assists'},low:{fi:'pieni osuus joukkueen syötöistä',en:'a small share of team assists'},same:{fi:'lähes sama osuus syötöistä',en:'nearly the same share of assists'},unit:'%'},
 rebounds:{high:{fi:'iso osuus joukkueen levypalloista',en:'a large share of team rebounds'},low:{fi:'pieni osuus joukkueen levypalloista',en:'a small share of team rebounds'},same:{fi:'lähes sama osuus levypalloista',en:'nearly the same share of rebounds'},unit:'%'},
 freeThrows:{high:{fi:'paljon vapaaheittoja',en:'many free throws'},low:{fi:'vähän vapaaheittoja',en:'few free throws'},same:{fi:'lähes sama vapaaheittojen määrä',en:'nearly the same free throw rate'},unit:'%'},
};
export const reasonText=({key,level},lang='fi')=>TRAITS[key][level][lang];
// Players to try, from the selected season when it has any. One per team first, so the set shows the whole league.
export function suggestedPlayers(players,seasonId,count=8,random=Math.random){
 const season=players.filter(row=>row.season===seasonId),pool=season.length?season:players;
 const seen=new Set(),unique=pool.filter(row=>!seen.has(row.id)&&seen.add(row.id));
 const shuffled=unique.map(row=>({row,order:random()})).sort((a,b)=>a.order-b.order).map(({row})=>row);
 const teams=new Set(),first=[],rest=[];
 for(const row of shuffled){if(teams.has(row.team))rest.push(row);else{teams.add(row.team);first.push(row);}}
 return [...first,...rest].slice(0,count);
}
export const standoutTrait=row=>row.similar?.flatMap(match=>match.reasons).find(reason=>reason.level!=='same')??null;
// Where each number sits among the league's players, 0–100, so six different scales fit on one chart.
export function featurePositions(players){
 const sorted=Object.fromEntries(SIMILAR_FEATURES.map(key=>[key,players.map(row=>row.values[key]).sort((a,b)=>a-b)]));
 return row=>Object.fromEntries(SIMILAR_FEATURES.map(key=>{
  const values=sorted[key],below=values.filter(value=>value<row.values[key]).length,level=values.filter(value=>value===row.values[key]).length;
  return [key,values.length?100*(below+level/2)/values.length:50];
 }));
}
export const FEATURE_SHORT={three:{fi:'Kolmoset',en:'Threes'},rim:{fi:'Korin alta',en:'At the rim'},usage:{fi:'Käyttöaste',en:'Usage'},assists:{fi:'Syötöt',en:'Assists'},rebounds:{fi:'Levypallot',en:'Rebounds'},freeThrows:{fi:'Vapaaheitot',en:'Free throws'}};
export const FEATURE_LABELS={
 three:{fi:'Kolmosten osuus heitoista',en:'Threes, share of shots'},
 rim:{fi:'Heitot korin alta',en:'Shots at the rim'},
 usage:{fi:'Käyttöaste',en:'Usage'},
 assists:{fi:'Osuus joukkueen syötöistä',en:'Share of team assists'},
 rebounds:{fi:'Osuus joukkueen levypalloista',en:'Share of team rebounds'},
 freeThrows:{fi:'Vapaaheitot / heitot',en:'Free throws per shot'},
};
