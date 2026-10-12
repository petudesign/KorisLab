const finite=Number.isFinite;
const ratio=(a,b,scale=1)=>finite(a)&&finite(b)&&b>0?scale*a/b:null;
const sum=(rows,key)=>rows.length&&rows.every(r=>finite(r[key]))?rows.reduce((s,r)=>s+r[key],0):null;
const normalize=name=>name.normalize('NFC').trim().toLocaleLowerCase('fi').replace(/\s+/g,' ');

export function changeRecords(games,{playerId,teamName}){
 return games.filter(g=>g.verified&&g.date&&g.teams.length===2).flatMap(g=>{
  const own=g.teams.find(t=>playerId?t.players.some(p=>p.id===playerId&&p.minutesValue>0):t.name===teamName);
  if(!own)return [];
  const other=g.teams.find(t=>t!==own),player=playerId?own.players.find(p=>p.id===playerId):null,s=player?.stats||own.stats;
  const possessions=t=>['two_pa','three_pa','fta','offensive_rebounds','turnovers'].every(k=>finite(t.stats[k]))?t.stats.two_pa+t.stats.three_pa+.44*t.stats.fta-t.stats.offensive_rebounds+t.stats.turnovers:null;
  const a=possessions(own),b=possessions(other);
  return [{id:g.id,date:g.date,team:own.name,opponent:other.name,score:own.score,allowed:other.score,sourceUrl:g.sourceUrl,
   minutes:player?.minutesValue,starts:player?Number(player.starter):null,points:player?s.points:own.score,
   attempts:finite(s.two_pa)&&finite(s.three_pa)?s.two_pa+s.three_pa:null,
   effectiveMade:finite(s.two_pm)&&finite(s.three_pm)?s.two_pm+1.5*s.three_pm:null,
   threeAttempts:s.three_pa,rebounds:s.rebounds,assists:s.assists,turnovers:s.turnovers,
   offensiveRebounds:s.offensive_rebounds,opponentDefensiveRebounds:other.stats.defensive_rebounds,
   possessions:finite(a)&&finite(b)?(a+b)/2:null}];
 }).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)||String(a.id).localeCompare(String(b.id)));
}

export function previousPlayerIdentity(games,player){
 const unique=new Map();
 for(const g of games.filter(g=>g.verified))for(const t of g.teams)for(const p of t.players)unique.set(p.id,p);
 if(unique.has(player.id))return player.id;
 const matches=[...unique.values()].filter(p=>normalize(p.name)===normalize(player.name));
 return matches.length===1?matches[0].id:null;
}

export function summarizeChangeSample(rows,type){
 const n=rows.length,minutes=sum(rows,'minutes'),attempts=sum(rows,'attempts'),points=sum(rows,'points'),possessions=sum(rows,'possessions');
 const offensiveRebounds=sum(rows,'offensiveRebounds'),opponentDefensiveRebounds=sum(rows,'opponentDefensiveRebounds');
 return {games:n,minutes,attempts,teams:[...new Set(rows.map(r=>r.team))],
  points:ratio(points,n),minutesPerGame:ratio(minutes,n),starts:ratio(sum(rows,'starts'),n,100),
  points40:ratio(points,minutes,40),attempts40:ratio(attempts,minutes,40),
  efg:ratio(sum(rows,'effectiveMade'),attempts,100),rebounds40:ratio(sum(rows,'rebounds'),minutes,40),assists40:ratio(sum(rows,'assists'),minutes,40),
  offensive:ratio(points,possessions,100),defensive:ratio(sum(rows,'allowed'),possessions,100),
  turnovers:ratio(sum(rows,'turnovers'),possessions,100),
  orb:finite(offensiveRebounds)&&finite(opponentDefensiveRebounds)?ratio(offensiveRebounds,offensiveRebounds+opponentDefensiveRebounds,100):null,
  threes:ratio(sum(rows,'threeAttempts'),attempts,100),type};
}

const definitions={player:[
 ['points','Pisteet / ottelu','PTS / O',3,'Tuotanto'],['minutesPerGame','Peliaika / ottelu','MIN / O',4,'Rooli'],
 ['points40','Pisteet / 40 min','PTS / 40',4,'Tuotanto'],['attempts40','Heittomäärä / 40 min','FGA / 40',3,'Rooli'],
 ['efg','Heittojen tehokkuus','%',5,'Tehokkuus'],['assists40','Syöttöjä / 40 min','AST / 40',1.5,'Pelinteko'],
 ['rebounds40','Levypalloja / 40 min','REB / 40',2.5,'Levypallot'],['starts','Avausviisikossa','%',20,'Rooli']],
 team:[['offensive','Hyökkäystehokkuus','ORtg',5,'Hyökkäys'],['defensive','Puolustustehokkuus','DRtg',5,'Puolustus'],
 ['efg','Heittojen tehokkuus','%',5,'Heittäminen'],['turnovers','Menetykset / 100 pallonhallintaa','TO / 100',3,'Pallonhallinta'],
 ['orb','Hyökkäyslevypallot','%',5,'Levypallot'],['threes','Kolmosten osuus','%',5,'Heittovalinnat']]};

export function analyzeChange(currentRecords,previousRecords,{type='player',mode='recent'}={}){
 const recent=mode==='recent'?currentRecords.slice(-5):mode==='firstFive'?currentRecords.slice(0,5):currentRecords;
 const earlier=mode==='recent'?currentRecords.slice(0,-5):mode==='firstFive'?previousRecords.slice(0,5):previousRecords;
 const current=summarizeChangeSample(recent,type),baseline=summarizeChangeSample(earlier,type);
 const ready=mode==='recent'?recent.length===5&&earlier.length>=3:mode==='firstFive'?recent.length===5&&earlier.length===5:recent.length>=2&&earlier.length>=(type==='player'?8:5);
 const sufficient=ready&&(type!=='player'||current.minutes>=30&&baseline.minutes>=(mode==='firstFive'?30:120));
 const rows=definitions[type].map(([key,label,unit,threshold,category])=>{
  const available=finite(current[key])&&finite(baseline[key])&&(key!=='efg'||current.attempts>=30&&baseline.attempts>=30);
  const delta=available?current[key]-baseline[key]:null;
  return {key,label,unit,category,current:available?current[key]:null,baseline:available?baseline[key]:null,delta,
   strength:finite(delta)?Math.abs(delta)/threshold:0,neutral:['minutesPerGame','attempts40','starts','threes'].includes(key),lowerBetter:['defensive','turnovers'].includes(key)};
 });
 const categories=new Set(),notable=[];
 for(const row of rows.filter(r=>r.strength>=1).sort((a,b)=>b.strength-a.strength)){
  if(categories.has(row.category))continue;
  categories.add(row.category);notable.push(row);if(notable.length===3)break;
 }
 let summary='Vertailussa ei näy suuria muutoksia valituilla mittareilla.';
 if(type==='player'){
  const p=rows.find(r=>r.key==='points'),m=rows.find(r=>r.key==='minutesPerGame'),rate=rows.find(r=>r.key==='points40'),volume=rows.find(r=>r.key==='attempts40'),shooting=rows.find(r=>r.key==='efg');
  if(p.strength>=1&&m.strength>=1&&rate.strength<1&&finite(rate.delta))summary='Pistekeskiarvo muuttui yhdessä peliajan kanssa. Tuotanto 40 minuuttia kohti pysyi lähellä vertailutasoa.';
  else if(rate.strength>=1&&volume.strength>=1&&Math.sign(rate.delta)===Math.sign(volume.delta)&&finite(shooting.delta)&&shooting.strength<1)summary='Pistetuotanto ja heittomäärä 40 minuuttia kohti muuttuivat samaan suuntaan. Heittotehokkuus pysyi lähellä vertailutasoa.';
  else if(rate.strength>=1)summary='Muutos ei rajoitu peliaikaan: myös pistetuotanto 40 minuuttia kohti muuttui.';
  else if(notable.length)summary='Muutos näkyy useassa osatekijässä. Peliaika, heittomäärä ja tehokkuus kannattaa erottaa toisistaan.';
 }else if(notable.length){
  const offense=rows.find(r=>r.key==='offensive'),shooting=rows.find(r=>r.key==='efg'),turnovers=rows.find(r=>r.key==='turnovers');
  summary=offense.delta<=-5&&shooting.strength<1&&finite(shooting.delta)&&turnovers.delta>=3?'Hyökkäystehokkuus laski, vaikka heittotehokkuus pysyi lähellä vertailutasoa. Samalla menetyksiä tuli enemmän pallonhallintaa kohti.':'Joukkueen luvut ovat muuttuneet. Vertailu erottaa tehokkuuden, pallonhallinnan ja heittovalinnat.';
 }
 return {ready:sufficient,current,baseline,rows,notable,summary,recent,earlier,teamChanged:type==='player'&&current.teams.some(t=>!baseline.teams.includes(t))};
}

// Opening-period context must not reveal team results from later in the season.
export function changeContextGames(games,records,mode){
 if(mode!=='firstFive')return games;
 const cutoff=records.at(-1)?.date;
 if(!cutoff)return [];
 return games.filter(game=>game.date&&Date.parse(game.date)<=Date.parse(cutoff));
}
