// Team strength with the schedule taken into account: home margin = home edge + home rating - away rating.
// Values are the locked ones in learning/forecasting/model-lock-power-rating-v1.json; a test keeps them in step.
export const POWER_PARAMS={men:{shrink:8,home:2,sigma:11},women:{shrink:.1,home:0,sigma:11}};
const INTERVAL_80=1.2816;
function invert(matrix){
 const size=matrix.length,work=matrix.map((row,i)=>[...row,...row.map((_,j)=>Number(i===j))]);
 for(let col=0;col<size;col++){
  let pivot=col;for(let row=col+1;row<size;row++)if(Math.abs(work[row][col])>Math.abs(work[pivot][col]))pivot=row;
  [work[col],work[pivot]]=[work[pivot],work[col]];
  const divisor=work[col][col];work[col]=work[col].map(v=>v/divisor);
  for(let row=0;row<size;row++)if(row!==col&&work[row][col]){const factor=work[row][col];work[row]=work[row].map((v,i)=>v-factor*work[col][i]);}
 }
 return work.map(row=>row.slice(size));
}
// `results` are {home,away,margin}. Gives each team's rating, its 80 % range, schedule strength and record, best first.
export function powerRanking(results,{shrink,home,sigma}){
 const teams=[...new Set(results.flatMap(r=>[r.home,r.away]))].sort(),index=new Map(teams.map((t,i)=>[t,i]));
 const normal=teams.map((_,i)=>teams.map((_,j)=>i===j?shrink:0)),target=teams.map(()=>0);
 for(const {home:a,away:b,margin} of results){const i=index.get(a),j=index.get(b);normal[i][i]++;normal[j][j]++;normal[i][j]--;normal[j][i]--;target[i]+=margin-home;target[j]-=margin-home;}
 const inverse=invert(normal),rating=teams.map((_,i)=>target.reduce((sum,value,k)=>sum+inverse[i][k]*value,0));
 const rows=teams.map((team,i)=>({team,rating:rating[i],spread:INTERVAL_80*sigma*Math.sqrt(inverse[i][i]),games:0,wins:0,opponents:0}));
 for(const {home:a,away:b,margin} of results){const x=rows[index.get(a)],y=rows[index.get(b)];x.games++;y.games++;x.opponents+=y.rating;y.opponents+=x.rating;if(margin>0)x.wins++;else if(margin<0)y.wins++;}
 return rows.map(row=>({...row,schedule:row.games?row.opponents/row.games:0})).sort((a,b)=>b.rating-a.rating||a.team.localeCompare(b.team));
}
export const resultsFromGames=games=>games.filter(g=>g.verified&&g.teams?.length===2).flatMap(g=>{const h=g.teams.find(t=>t.side==='home'),a=g.teams.find(t=>t.side==='away');return h&&a&&Number.isFinite(h.score)&&Number.isFinite(a.score)?[{home:h.name,away:a.name,margin:h.score-a.score}]:[];});
