// Player data that needs many games at once: how baskets came about, biggest moments and similar players.
// Built from the published games, stories and shots, so it is always in step with them.
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {aggregateSeasonPlayers,playerUsagePct} from '../src/lib/playerStats.ts';
import {estimateShotDistanceMeters} from '../src/lib/shotStats.ts';
import {playerEventsFromSeason} from '../src/lib/playerEvents.js';
import {SIMILAR_MIN_GAMES,SIMILAR_MIN_LOCATED,SIMILAR_MIN_MINUTES,buildSimilar} from '../src/lib/similarPlayers.js';
const data=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/data');
const json=file=>JSON.parse(readFileSync(path.join(data,file)));
const RIM_METERS=2.5,GAME_MINUTES=40;
const percent=(part,whole)=>whole>0?100*part/whole:null;
function recordsOf(games){return games.filter(g=>g.verified).map(g=>({game:{source_id:g.id},teams:g.teams.map(t=>({...t,source_id:t.id,home_away:t.side,players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));}
// A player's share of the team's assists and rebounds while they were on the floor, as usage does for plays.
function teamShares(games){
 const shares=new Map();
 for(const game of games){
  if(!game.verified)continue;
  for(const team of game.teams)for(const player of team.players){
   if(!(player.minutesValue>0))continue;
   const row=shares.get(player.id)??{assists:0,teamAssists:0,rebounds:0,teamRebounds:0};
   const part=player.minutesValue/GAME_MINUTES;
   row.assists+=player.stats.assists||0;row.teamAssists+=(team.stats.assists||0)*part;
   row.rebounds+=player.stats.rebounds||0;row.teamRebounds+=(team.stats.rebounds||0)*part;
   shares.set(player.id,row);
  }
 }
 return shares;
}
function seasonShapes(league,season,games){
 const file=`analysis/${league}-${season}-shots.json`;
 if(!existsSync(path.join(data,file)))return [];
 const shots=new Map(json(file).players.map(row=>[row.id,row.shots])),shares=teamShares(games),rows=[];
 for(const player of aggregateSeasonPlayers(recordsOf(games))){
  const located=(shots.get(player.id)??[]).filter(shot=>shot.x!=null&&shot.y!=null),attempts=player.twoPA+player.threePA,usage=playerUsagePct(player),share=shares.get(player.id);
  if(player.games<SIMILAR_MIN_GAMES||player.knownMinutes<SIMILAR_MIN_MINUTES||located.length<SIMILAR_MIN_LOCATED||!Number.isFinite(usage)||!share?.teamAssists||!share.teamRebounds)continue;
  rows.push({id:player.id,name:player.name,team:player.team,season,games:player.games,minutes:Math.round(player.knownMinutes),values:{
   three:percent(player.threePA,attempts),
   rim:percent(located.filter(shot=>estimateShotDistanceMeters(shot)<RIM_METERS).length,located.length),
   usage,
   assists:percent(share.assists,share.teamAssists),
   rebounds:percent(share.rebounds,share.teamRebounds),
   freeThrows:percent(player.fta,attempts),
  }});
 }
 return rows;
}
const stories=readdirSync(path.join(data,'stories'));
for(const dir of ['player-events','similar'])mkdirSync(path.join(data,dir),{recursive:true});
for(const league of ['men','women']){
 const shapes=[],skipped=[];
 for(const season of ['2024-25','2025-26','2026-27']){
  const games=json(`${league}-${season}-matches.json`),prefix=`${league}-${season}-`;
  const result=playerEventsFromSeason(games,stories.filter(file=>file.startsWith(prefix)).sort().map(file=>json(`stories/${file}`)));
  writeFileSync(path.join(data,`player-events/${league}-${season}.json`),JSON.stringify(result));
  const rows=seasonShapes(league,season,games);
  if(rows.length)shapes.push(...rows);else skipped.push(season);
  console.log(`Player data: ${prefix.slice(0,-1)} ${result.games} games, ${result.excluded.length} left out, ${rows.length} player shapes.`);
 }
 writeFileSync(path.join(data,`similar/${league}.json`),JSON.stringify({skipped,players:buildSimilar(shapes)}));
}
