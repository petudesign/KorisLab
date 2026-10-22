import {playerPerGame,playerFgPctFromTotals,playerFtPctFromTotals,playerEfGPctFromTotals,playerTrueShootingPctFromTotals,playerEfficiencyPer40,playerAssistTurnoverRatio,playerAttemptsPer40} from './playerStats.ts';

const perGame=key=>p=>playerPerGame(p,key);
export const profileMetrics=[
 {key:'points',label:'Pisteet',unit:'PTS / O',read:perGame('points'),note:'Per ottelu',accent:'#df945b'},
 {key:'assists',label:'Syötöt',unit:'AST / O',read:perGame('assists'),note:'Per ottelu',accent:'#44d17a'},
 {key:'rebounds',label:'Levypallot',unit:'REB / O',read:perGame('rebounds'),note:'Per ottelu',accent:'#91b4c8'},
 {key:'steals',label:'Riistot',unit:'STL / O',read:perGame('steals'),note:'Per ottelu'},
 {key:'blocks',label:'Torjunnat',unit:'BLK / O',read:perGame('blocks'),note:'Per ottelu'},
 {key:'blocksReceived',label:'Blokatut heitot',unit:'BR / O',read:perGame('blocksReceived'),note:'Vastustajan torjumat / ottelu'},
 {key:'plusMinus',label:'+/−',unit:'+/−',read:perGame('plusMinus'),note:'Piste-ero kentällä / ottelu',signed:true},
 {key:'minutes',label:'Peliaika',unit:'MIN / O',read:p=>p.games>0&&Number.isFinite(p.minutes)?p.minutes/p.games:null,note:'Per ottelu'},
 {key:'games',label:'Ottelut',unit:'O',read:p=>p.games,note:'Tilastoitua ottelua',decimals:0,noTrend:true},
 {key:'assistTurnover',label:'AST / TO',unit:'AST / TO',read:playerAssistTurnoverRatio,note:'Syötöt suhteessa menetyksiin'},
 {key:'freeThrows',label:'Vapaaheitot',unit:'FT %',read:playerFtPctFromTotals,note:'Onnistuneet / yritykset',pooled:true},
 {key:'efficiency',label:'Tehokkuus',unit:'EFF / 40',read:playerEfficiencyPer40,note:'Tehokkuus / 40 minuuttia'},
 {key:'fieldGoals',label:'Heittotarkkuus',unit:'FG %',read:playerFgPctFromTotals,note:'Kenttäheitot',pooled:true},
 {key:'effectiveFieldGoals',label:'Heittojen tehokkuus',unit:'eFG %',read:playerEfGPctFromTotals,note:'Kolmosten lisäarvo huomioitu',pooled:true},
 {key:'trueShooting',label:'Pisteiden tehokkuus',unit:'TS %',read:playerTrueShootingPctFromTotals,note:'Kenttäheitot ja vapaaheitot',pooled:true},
 {key:'attempts',label:'Heittomäärä',unit:'FGA / 40',read:playerAttemptsPer40,note:'Kenttäheittoyritykset / 40 min'},
];

export function profileLeagueBenchmarks(players,games){
 const counts=new Map();
 for(const game of games.filter(g=>g.verified))for(const team of game.teams)counts.set(team.name,(counts.get(team.name)||0)+1);
 const minimum=Math.max(1,Math.ceil(Math.max(0,...counts.values())/2));
 const qualified=players.filter(p=>p.games>=minimum);
 const totals=Object.fromEntries(['points','twoPM','twoPA','threePM','threePA','ftm','fta'].map(key=>[key,qualified.reduce((sum,p)=>sum+p[key],0)]));
 const averages=Object.fromEntries(profileMetrics.filter(d=>!d.noTrend).map(d=>{
  const values=qualified.map(d.read).filter(Number.isFinite);
  return [d.key,d.pooled?d.read(totals):values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null];
 }));
 return {minimum,count:qualified.length,averages};
}

export function playerProfileHistory(games,id){
 return games.filter(g=>g.verified).flatMap(g=>{
  const team=g.teams.find(t=>t.players.some(p=>p.id===id&&(p.minutesValue>0||p.participated===true)));
  if(!team)return [];
  const player=team.players.find(p=>p.id===id),stats=player.stats;
  const sample={games:1,minutes:player.minutesValue??Number.NaN,points:stats.points,assists:stats.assists,rebounds:stats.rebounds,steals:stats.steals,blocks:stats.blocks,blocksReceived:stats.blocks_received,plusMinus:stats.plus_minus,turnovers:stats.turnovers,twoPM:stats.two_pm,twoPA:stats.two_pa,threePM:stats.three_pm,threePA:stats.three_pa,ftm:stats.ftm,fta:stats.fta,efficiency:stats.efficiency};
  const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
  return [{id:g.id,date:g.date,home:home.name,away:away.name,homeScore:home.score,awayScore:away.score,...Object.fromEntries(profileMetrics.filter(d=>!d.noTrend).map(d=>[d.key,d.read(sample)]))}];
 }).sort((a,b)=>new Date(a.date)-new Date(b.date)||String(a.id).localeCompare(String(b.id))).slice(-5);
}
