// Match only published budgets to verified results from the same season.
export function teamResourceRows(seasonInfo,games){
 const records=new Map();
 for(const game of games||[]){
  if(!game.verified||game.teams?.length!==2||!game.teams.every(t=>Number.isFinite(t.score)))continue;
  for(const team of game.teams){
   const opponent=game.teams.find(t=>t!==team),row=records.get(team.name)||{games:0,wins:0,losses:0};
   row.games++;if(team.score>opponent.score)row.wins++;else if(team.score<opponent.score)row.losses++;
   records.set(team.name,row);
  }
 }
 return Object.entries(seasonInfo?.teams||{}).map(([name,info])=>{
  const record=records.get(name),validBudget=Number.isFinite(info.budget)&&info.budget>0;
  return {name,budget:info.budget,payroll:info.payroll,
   games:record?.games??null,wins:record?.wins??null,losses:record?.losses??null,
   efficiency:validBudget&&record?.games>0?100000*record.wins/info.budget:null};
 });
}

export function rankTeamResources(rows,metric){
 if(!['budget','payroll','efficiency'].includes(metric))return [];
 const ordered=[...rows].sort((a,b)=>{
  const af=Number.isFinite(a[metric]),bf=Number.isFinite(b[metric]);
  if(af!==bf)return af?-1:1;
  return af?b[metric]-a[metric]||a.name.localeCompare(b.name,'fi'):a.name.localeCompare(b.name,'fi');
 });
 return ordered.map(row=>({...row,rank:Number.isFinite(row[metric])?1+ordered.filter(other=>Number.isFinite(other[metric])&&other[metric]>row[metric]+1e-9).length:null}));
}

// A season brief also publishes the prior year's figures; keep their year explicit.
export function resourceInfoForSeason(packs,seasonId,teamNames){
 const direct=packs?.[seasonId];
 const year=Number(seasonId?.slice(0,4));
 const nextId=`${year+1}-${String((year+2)%100).padStart(2,'0')}`;
 const pack=direct||packs?.[nextId];
 if(!pack)return null;
 return {...pack,teams:Object.fromEntries(teamNames.map(name=>{
  const row=pack.teams[name];
  return [name,{budget:(direct?row?.budget:row?.previousBudget)??null,payroll:(direct?row?.payroll:row?.previousPayroll)??null}];
 }))};
}
