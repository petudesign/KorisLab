// Only finished, scored games belong in the results rail; fixtures stay in Matches.
export function recentResults(games) {
 return games.filter(g => ['played','finished','completed'].includes(g.status)
  && g.teams?.length === 2 && g.teams.every(t => Number.isFinite(t.score)))
  .sort((a,b) => (b.date || '').localeCompare(a.date || '') || String(b.id).localeCompare(String(a.id), undefined, {numeric:true}))
  .slice(0,4).map(g => {
   const home=g.teams.find(t=>t.side==='home'),away=g.teams.find(t=>t.side==='away');
   return {id:g.id,date:g.date,home:home.name,away:away.name,venue:g.venue,
    value:`${home.score} - ${away.score}`,action:g.verified?'Katso analyysi':'Katso tulos'};
  });
}
