import {POWER_PARAMS,powerRanking,resultsFromGames} from './powerRating.js';
import {trueShootingPct} from './playerStats.ts';
// A player's numbers against the upper and lower half of the league. Order is today's power rating, not the rating on the day:
// early in a season the rating on the day is mostly noise, and later games would not count at all.
// Halves rather than above or below average, since one very weak team would otherwise put most of the league above it.
export const SPLIT_MIN_GAMES=3,SPLIT_MIN_MINUTES=30,SPLIT_SMALL_GAMES=8;
const blank=()=>({games:0,minutes:0,minutesGames:0,points:0,minutesPoints:0,fieldGoalAttempts:0,freeThrowAttempts:0,opponents:new Set()});
const played=player=>player&&(player.minutesValue>0||player.participated===true);
function finish(side){
 return {...side,opponents:[...side.opponents].sort((a,b)=>a.localeCompare(b,'fi')),
  pointsPer40:side.minutes>0?side.minutesPoints/side.minutes*40:null,
  minutesPerGame:side.minutesGames?side.minutes/side.minutesGames:null,
  trueShooting:trueShootingPct(side.points,side.fieldGoalAttempts,side.freeThrowAttempts)};
}
export function opponentSplit(games,playerId,leagueId){
 const results=resultsFromGames(games);
 if(!results.length)return null;
 const order=powerRanking(results,POWER_PARAMS[leagueId]??POWER_PARAMS.men).map(row=>row.team);
 // The player's own team is not an opponent. With an odd count the middle team goes to the lower half.
 const upperHalf=ownTeam=>{const opponents=order.filter(team=>team!==ownTeam);return new Set(opponents.slice(0,Math.floor(opponents.length/2)));};
 const upper=blank(),lower=blank();
 for(const game of games){
  if(!game.verified)continue;
  const own=game.teams.find(team=>team.players.some(player=>player.id===playerId)),player=own?.players.find(row=>row.id===playerId),other=game.teams.find(team=>team!==own);
  if(!played(player)||!order.includes(other?.name))continue;
  const side=upperHalf(own.name).has(other.name)?upper:lower,stats=player.stats;
  side.games++;side.opponents.add(other.name);
  side.points+=stats.points||0;
  side.fieldGoalAttempts+=(stats.two_pa||0)+(stats.three_pa||0);side.freeThrowAttempts+=stats.fta||0;
  if(Number.isFinite(player.minutesValue)&&player.minutesValue>0){side.minutes+=player.minutesValue;side.minutesGames++;side.minutesPoints+=stats.points||0;}
 }
 const enough=[upper,lower].every(side=>side.games>=SPLIT_MIN_GAMES&&side.minutes>=SPLIT_MIN_MINUTES);
 return {upper:finish(upper),lower:finish(lower),enough,small:Math.min(upper.games,lower.games)<SPLIT_SMALL_GAMES};
}
