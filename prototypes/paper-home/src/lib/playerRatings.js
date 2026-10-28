// Player ratings on a 1–99 scale: the share of the league's regular players this player is ahead of.
// Rates are shrunk toward a typical regular before ranking, so a hot first week cannot reach the top. Nobody gets 100.
export const POOL_MINUTES=60;
// Regulars: at least a sixth of the busiest player's minutes, so a full season is not ranked against the end of the bench.
export const ratingPool=players=>{const busiest=Math.max(0,...players.map(p=>p.minutes||0));return players.filter(p=>p.minutes>=Math.max(POOL_MINUTES,busiest/6));};
const PRIOR={minutes:120,shots:60,threes:80,turnovers:15};

export const ratingAxes=[
 {key:'scoring',fi:'Pisteiden teko',en:'Scoring'},
 {key:'efficiency',fi:'Heittotehokkuus',en:'Shooting efficiency'},
 {key:'threes',fi:'Kolmoset',en:'Three-point shooting'},
 {key:'playmaking',fi:'Pelinrakennus',en:'Playmaking'},
 {key:'rebounding',fi:'Levypallot',en:'Rebounding'},
 {key:'defense',fi:'Riistot ja torjunnat',en:'Steals and blocks'},
];

const sum=(rows,read)=>rows.reduce((total,p)=>total+(read(p)??0),0);
const shotAttempts=p=>p.twoPA+p.threePA+0.44*p.fta;
const per40=(value,minutes)=>40*value/minutes;
// Pull a total toward the league rate with `weight` units of league-average exposure.
const shrink=(value,exposure,leagueRate,weight)=>(value+leagueRate*weight)/(exposure+weight);

const median=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?(v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2):null;};
// The typical regular, not the minutes-weighted average: starters dominate that and would lift every small sample above the middle.
function leagueRates(pool){
 const rate=read=>median(pool.map(read));
 return {
  points:rate(p=>p.points/p.minutes),rebounds:rate(p=>p.rebounds/p.minutes),assists:rate(p=>p.assists/p.minutes),
  threeAttempts:rate(p=>p.threePA/p.minutes),stocks:rate(p=>p.steals==null||p.blocks==null?null:(p.steals+p.blocks)/p.minutes),
  trueShooting:sum(pool,p=>p.points)/(2*sum(pool,shotAttempts)),threePct:sum(pool,p=>p.threePM)/sum(pool,p=>p.threePA),
  assistTurnover:rate(p=>p.turnovers?p.assists/p.turnovers:null),
 };
}

// Shrunk raw values; `shown` keeps the plain season numbers that are printed next to the rating.
export function playerRatingInputs(p,league){
 if(!(p.minutes>0))return null;
 const m=p.minutes,k=PRIOR.minutes,tsa=shotAttempts(p),stocks=p.steals==null||p.blocks==null?null:p.steals+p.blocks;
 const ast=shrink(p.assists,m,league.assists,k);
 return {
  scoring:40*shrink(p.points,m,league.points,k),
  efficiency:shrink(p.points/2,tsa,league.trueShooting,PRIOR.shots),
  threePct:shrink(p.threePM,p.threePA,league.threePct,PRIOR.threes),threeVolume:40*shrink(p.threePA,m,league.threeAttempts,k),
  assists:40*ast,assistTurnover:shrink(p.assists,p.turnovers,league.assistTurnover,PRIOR.turnovers),
  rebounding:40*shrink(p.rebounds,m,league.rebounds,k),
  defense:stocks==null||league.stocks==null?null:40*shrink(stocks,m,league.stocks,k),
  shown:{
   scoring:per40(p.points,m),efficiency:tsa?100*p.points/(2*tsa):null,threePct:p.threePA?100*p.threePM/p.threePA:null,threePA:per40(p.threePA,m),
   assists:per40(p.assists,m),assistTurnover:p.turnovers?p.assists/p.turnovers:null,rebounding:per40(p.rebounds,m),defense:stocks==null?null:per40(stocks,m),
  },
 };
}

// Share of the pool below the value, ties counted half. Maps to 1–99, so the top of a 40-player league is 99, never 100.
export function ratingFromPool(value,pool){
 const known=pool.filter(Number.isFinite);
 if(!Number.isFinite(value)||known.length<5)return null;
 const below=known.filter(v=>v<value).length,ties=known.filter(v=>v===value).length;
 return Math.max(1,Math.min(99,Math.round(1+98*(below+ties/2)/known.length)));
}

const blend=(parts)=>parts.some(v=>v==null)?null:parts.reduce((total,[v,w])=>total+v*w,0);

export function playerRatings(player,players){
 const pool=ratingPool(players);
 if(pool.length<5)return null;
 const league=leagueRates(pool),inputs=new Map(pool.map(p=>[p.id,playerRatingInputs(p,league)]));
 const own=inputs.get(player.id),threshold=Math.min(...pool.map(p=>p.minutes));
 // Outside the regulars the sample is too small to place honestly, so the page says how far the player is from a rating.
 if(!own)return {qualified:false,minutes:player.minutes,threshold,pool:pool.length};
 const all=[...inputs.values()],column=key=>all.map(i=>i[key]);
 const rate=key=>ratingFromPool(own[key],column(key));
 // Two-part axes are a weighted mix of the part ratings, then ranked again so the axis still spans 1–99.
 const mixed=(parts)=>{
  const score=i=>blend(parts.map(([key,w])=>[ratingFromPool(i[key],column(key)),w]));
  return ratingFromPool(score(own),all.map(score));
 };
 const values={
  scoring:rate('scoring'),efficiency:rate('efficiency'),
  threes:mixed([['threePct',.5],['threeVolume',.5]]),playmaking:mixed([['assists',.65],['assistTurnover',.35]]),
  rebounding:rate('rebounding'),defense:rate('defense'),
 };
 return {axes:ratingAxes.map(axis=>({...axis,rating:values[axis.key]})),shown:own.shown,pool:pool.length,qualified:true,minutes:player.minutes,types:playerTypes(values)};
}

// A short description from the strongest ratings. Rules are deliberately few so a reader can check them.
export function playerTypes(r){
 const known=Object.values(r).filter(Number.isFinite);
 if(known.length<4)return [];
 const types=[];
 if(r.threes>=75)types.push('shooter');
 if(r.playmaking>=75)types.push('playmaker');
 if(r.rebounding>=75&&(r.threes??0)<50)types.push('inside');
 else if(r.rebounding>=80)types.push('rebounder');
 if(r.scoring>=80)types.push('scorer');
 if(r.defense>=80)types.push('disruptor');
 if(known.filter(v=>v>=65).length>=5)types.unshift('allround');
 return types.length?types.slice(0,2):['role'];
}

export const typeLabels={
 shooter:['Kolmosheittäjä','Shooter'],playmaker:['Pelinrakentaja','Playmaker'],inside:['Sisäpelaaja','Inside player'],rebounder:['Levypallopelaaja','Rebounder'],
 scorer:['Pisteiden tekijä','Scorer'],disruptor:['Riistäjä ja torjuja','Disruptor'],allround:['Monipuolinen','All-rounder'],role:['Roolipelaaja','Role player'],
};
