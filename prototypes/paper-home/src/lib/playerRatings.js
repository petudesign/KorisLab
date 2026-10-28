// Player ratings on a fixed 1–99 scale. 50 is a typical regular of the completed reference seasons, and each
// rating moves with the distance from that level, so a clear lead shows as a clear gap and seasons compare.
// Rates are shrunk toward the typical regular first, harder for short minutes per game. Nobody gets 100.
export const POOL_MINUTES=60;
// Regulars: at least a sixth of the busiest player's minutes, so a full season is not ranked against the end of the bench.
export const ratingPool=players=>{const busiest=Math.max(0,...players.map(p=>p.minutes||0));return players.filter(p=>p.minutes>=Math.max(POOL_MINUTES,busiest/6));};
// Rating points per robust standard deviation: about 1 in 40 regulars reaches 90 on an axis.
export const SLOPE=20;
const PRIOR={minutes:120,shots:60,threes:80,turnovers:15};
// Per-40 numbers assume the rate holds over more minutes. Short shifts are often against other benches or in
// decided games, so up to three times more typical minutes are added for a player who plays under 28 a game.
export const fullShiftMinutes=28;
export const priorMinutes=minutesPerGame=>PRIOR.minutes*Math.min(3,Math.max(1,fullShiftMinutes/minutesPerGame));

export const ratingAxes=[
 {key:'scoring',fi:'Pisteiden teko',en:'Scoring',parts:[['scoring',1]]},
 {key:'efficiency',fi:'Heittotehokkuus',en:'Shooting efficiency',parts:[['efficiency',1]]},
 {key:'threes',fi:'Kolmoset',en:'Three-point shooting',parts:[['threePct',.5],['threeVolume',.5]]},
 {key:'playmaking',fi:'Pelinrakennus',en:'Playmaking',parts:[['assists',.65],['assistTurnover',.35]]},
 {key:'rebounding',fi:'Levypallot',en:'Rebounding',parts:[['rebounding',1]]},
 {key:'defense',fi:'Riistot ja torjunnat',en:'Steals and blocks',parts:[['defense',1]]},
];
// Counting rates are skewed (a few very high values), so they are compared on a square-root scale.
const transform={scoring:Math.sqrt,threeVolume:Math.sqrt,assists:Math.sqrt,rebounding:Math.sqrt,defense:Math.sqrt,assistTurnover:Math.log};

const sum=(rows,read)=>rows.reduce((total,p)=>total+(read(p)??0),0);
const shotAttempts=p=>p.twoPA+p.threePA+0.44*p.fta;
const per40=(value,minutes)=>40*value/minutes;
const shrink=(value,exposure,typicalRate,weight)=>(value+typicalRate*weight)/(exposure+weight);
const quantile=(sorted,q)=>{const i=(sorted.length-1)*q,lo=Math.floor(i);return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo);};
const spread=values=>{const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length<5?null:{center:quantile(v,.5),scale:(quantile(v,.84)-quantile(v,.16))/2};};
const median=values=>spread(values)?.center??null;

// The typical regular, not the minutes-weighted average: starters dominate that and would lift every small sample above the middle.
export function typicalRates(pool){
 const rate=read=>median(pool.map(read));
 return {
  points:rate(p=>p.points/p.minutes),rebounds:rate(p=>p.rebounds/p.minutes),assists:rate(p=>p.assists/p.minutes),
  threeAttempts:rate(p=>p.threePA/p.minutes),stocks:rate(p=>p.steals==null||p.blocks==null?null:(p.steals+p.blocks)/p.minutes),
  trueShooting:sum(pool,p=>p.points)/(2*sum(pool,shotAttempts)),threePct:sum(pool,p=>p.threePM)/sum(pool,p=>p.threePA),
  assistTurnover:rate(p=>p.turnovers?p.assists/p.turnovers:null),
 };
}

// Shrunk values; `shown` keeps the plain season numbers printed next to each rating.
export function playerRatingInputs(p,typical){
 if(!(p.minutes>0&&p.games>0))return null;
 const m=p.minutes,k=priorMinutes(m/p.games),tsa=shotAttempts(p),stocks=p.steals==null||p.blocks==null?null:p.steals+p.blocks;
 return {
  scoring:40*shrink(p.points,m,typical.points,k),
  efficiency:shrink(p.points/2,tsa,typical.trueShooting,PRIOR.shots),
  threePct:shrink(p.threePM,p.threePA,typical.threePct,PRIOR.threes),threeVolume:40*shrink(p.threePA,m,typical.threeAttempts,k),
  assists:40*shrink(p.assists,m,typical.assists,k),assistTurnover:shrink(p.assists,p.turnovers,typical.assistTurnover,PRIOR.turnovers),
  rebounding:40*shrink(p.rebounds,m,typical.rebounds,k),
  defense:stocks==null||typical.stocks==null?null:40*shrink(stocks,m,typical.stocks,k),
  shown:{
   scoring:per40(p.points,m),efficiency:tsa?100*p.points/(2*tsa):null,threePct:p.threePA?100*p.threePM/p.threePA:null,threePA:per40(p.threePA,m),
   assists:per40(p.assists,m),assistTurnover:p.turnovers?p.assists/p.turnovers:null,rebounding:per40(p.rebounds,m),defense:stocks==null?null:per40(stocks,m),
  },
 };
}

const partScore=(inputs,key,scales)=>{
 const value=inputs[key],s=scales[key];
 if(!Number.isFinite(value)||!s?.scale)return null;
 return ((transform[key]?.(value)??value)-s.center)/s.scale;
};
// An axis score in robust standard deviations from the typical regular; two-part axes are rescaled after mixing.
export function axisScore(inputs,axis,scales){
 const parts=axis.parts.map(([key,weight])=>[partScore(inputs,key,scales),weight]);
 if(parts.some(([z])=>z==null))return null;
 const mixed=parts.reduce((total,[z,w])=>total+z*w,0);
 return parts.length>1?(mixed-scales[axis.key].center)/scales[axis.key].scale:mixed;
}
export const ratingFromScore=z=>z==null?null:Math.max(1,Math.min(99,Math.round(50+SLOPE*z)));

// Built once from completed seasons (scripts/build-rating-reference.mjs): typical rates and the spread of every input.
export function buildRatingReference(seasons){
 const pools=seasons.map(ratingPool),regulars=pools.flat();
 const typical=typicalRates(regulars),inputs=regulars.map(p=>playerRatingInputs(p,typical)).filter(Boolean);
 const scales={};
 for(const key of new Set(ratingAxes.flatMap(axis=>axis.parts.map(([part])=>part)))){
  scales[key]=spread(inputs.map(i=>Number.isFinite(i[key])?(transform[key]?.(i[key])??i[key]):null));
 }
 for(const axis of ratingAxes.filter(axis=>axis.parts.length>1)){
  scales[axis.key]={center:0,scale:1};
  scales[axis.key]=spread(inputs.map(i=>axisScore(i,axis,scales)));
 }
 const round=value=>Math.round(value*1e6)/1e6;
 return {regulars:regulars.length,typical:Object.fromEntries(Object.entries(typical).map(([k,v])=>[k,round(v)])),
  scales:Object.fromEntries(Object.entries(scales).map(([k,s])=>[k,s&&{center:round(s.center),scale:round(s.scale)}]))};
}

// How far a reader can lean on the numbers: minutes behind them, not the size of the rating.
export const reliability=minutes=>minutes<200?'early':minutes<500?'moderate':'settled';

export function playerRatings(player,players,reference){
 const pool=ratingPool(players);
 if(pool.length<5||!reference)return null;
 const own=pool.some(p=>p.id===player.id)?playerRatingInputs(player,reference.typical):null;
 // Outside the regulars the sample is too small to place honestly, so the page says how far the player is from a rating.
 if(!own)return {qualified:false,minutes:player.minutes,threshold:Math.min(...pool.map(p=>p.minutes)),pool:pool.length};
 const scores=pool.map(p=>[p.id,playerRatingInputs(p,reference.typical)]);
 const axes=ratingAxes.map(axis=>{
  const score=axisScore(own,axis,reference.scales),known=scores.map(([,i])=>axisScore(i,axis,reference.scales)).filter(z=>z!=null);
  return {...axis,rating:ratingFromScore(score),rank:score==null?null:1+known.filter(z=>z>score).length,count:known.length};
 });
 const values=Object.fromEntries(axes.map(axis=>[axis.key,axis.rating]));
 return {axes,shown:own.shown,pool:pool.length,qualified:true,minutes:player.minutes,minutesPerGame:player.minutes/player.games,
  reliability:reliability(player.minutes),reference:{regulars:reference.regulars,seasons:reference.seasons},types:playerTypes(values)};
}

// A short description from the strongest ratings. Rules are deliberately few so a reader can check them.
export function playerTypes(r){
 const known=Object.values(r).filter(Number.isFinite);
 if(known.length<4)return [];
 const types=[];
 if(r.threes>=70)types.push('shooter');
 if(r.playmaking>=70)types.push('playmaker');
 if(r.rebounding>=70&&(r.threes??0)<50)types.push('inside');
 else if(r.rebounding>=75)types.push('rebounder');
 if(r.scoring>=75)types.push('scorer');
 if(r.defense>=75)types.push('disruptor');
 if(known.filter(v=>v>=60).length>=5)types.unshift('allround');
 return types.length?types.slice(0,2):['role'];
}

export const typeLabels={
 shooter:['Kolmosheittäjä','Shooter'],playmaker:['Pelinrakentaja','Playmaker'],inside:['Sisäpelaaja','Inside player'],rebounder:['Levypallopelaaja','Rebounder'],
 scorer:['Pisteiden tekijä','Scorer'],disruptor:['Riistäjä ja torjuja','Disruptor'],allround:['Monipuolinen','All-rounder'],role:['Roolipelaaja','Role player'],
};
