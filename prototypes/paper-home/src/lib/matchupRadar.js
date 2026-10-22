export const radarAxes = [
 {key:'ortg',fi:'Hyökkäys',en:'Offense',unit:'ORtg'},
 {key:'drtg',fi:'Puolustus',en:'Defense',unit:'DRtg',lower:true},
 {key:'efg',fi:'Heittäminen',en:'Shooting',unit:'eFG %'},
 {key:'orbPct',fi:'Hyökkäyslevyt',en:'Offensive boards',unit:'ORB %'},
 {key:'tovPct',fi:'Pallonhallinta',en:'Ball security',unit:'TO / 100',lower:true},
 {key:'astTo',fi:'Pelinrakennus',en:'Playmaking',unit:'AST / TO'},
];
// Midrank on a shared league scale: ties share a rank, absent values stay absent.
export function leaguePercentile(value,pool,lower=false){
 const known=pool.filter(Number.isFinite);
 if(!Number.isFinite(value)||known.length<2)return null;
 const better=known.filter(n=>lower?n>value:n<value).length;
 const ties=known.filter(n=>n===value).length;
 return Math.max(0,Math.min(100,100*(better+(ties-1)/2)/(known.length-1)));
}
export function leagueRank(value,pool,lower=false){
 if(!Number.isFinite(value))return null;
 const known=pool.filter(Number.isFinite);
 if(!known.length)return null;
 return 1+known.filter(n=>lower?n<value:n>value).length;
}
export function radarProfile(entry,league){
 return radarAxes.map(axis=>({...axis,value:entry.values[axis.key]??null,rank:leagueRank(entry.values[axis.key],league.map(row=>row.values[axis.key]),axis.lower),percentile:leaguePercentile(entry.values[axis.key],league.map(row=>row.values[axis.key]),axis.lower),count:league.filter(row=>Number.isFinite(row.values[axis.key])).length}));
}
