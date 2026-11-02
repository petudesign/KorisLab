import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import test from 'node:test';
import {basketKinds,basketTotal,playerEventsFromSeason} from '../src/lib/playerEvents.js';
import {opponentSplit} from '../src/lib/opponentSplit.js';
import {buildSimilar,featurePositions,reasonText,similarityReasons,standoutTrait,suggestedPlayers} from '../src/lib/similarPlayers.js';
import {matchupComparison} from '../src/PlayerInsightsData.js';
import {AGE_MIN_SHARE,leagueRecords,seasonBests,shotBreakdown,teamAgeRows,teamAgeView} from '../src/lib/gameBests.js';

const data=file=>JSON.parse(readFileSync(new URL(`../public/data/${file}`,import.meta.url)));
const made=(s,n,extra={})=>({k:'2pt',s,n,m:true,t:1,w:.5,...extra});

test('a basket is assisted first, then after a rebound in the same attack, otherwise other',()=>{
 const kinds=basketKinds([
  {k:'offensive_rebound',s:'h'},made('h','A',{as:'B'}),
  {k:'offensive_rebound',s:'h'},made('h','A'),
  {k:'offensive_rebound',s:'h'},{k:'turnover',s:'h'},made('a','C'),
  {k:'offensive_rebound',s:'a'},{k:'period',s:''},made('a','C'),
  made('h','A'),
 ]);
 assert.deepEqual(kinds.map(row=>row.kind),['assisted','rebound','other','other','other']);
});
for(const [league,season] of [['men','2026-27'],['men','2025-26'],['women','2026-27'],['women','2025-26']])test(`basket types add up to the box score: ${league} ${season}`,()=>{
 const games=data(`${league}-${season}-matches.json`),events=data(`player-events/${league}-${season}.json`),left=new Set(events.excluded);
 const covered=games.filter(game=>game.verified&&!left.has(String(game.id))&&existsSync(new URL(`../public/data/stories/${league}-${season}-${game.id}.json`,import.meta.url)));
 assert.equal(covered.length,events.games);
 for(const [id,row] of Object.entries(events.players)){
  const box=covered.filter(game=>game.teams.some(team=>team.players.some(player=>player.id===id)));
  const fg=box.reduce((sum,game)=>{const stats=game.teams.flatMap(team=>team.players).find(player=>player.id===id).stats;return sum+(stats.two_pm||0)+(stats.three_pm||0);},0);
  assert.equal(basketTotal(row.baskets),fg,`${id} differs from the box score`);
 }
});
test('a game whose events do not match the box score is left out, not half counted',()=>{
 const game={id:'1',verified:true,date:'2026-10-01',teams:[{side:'home',name:'H',players:[{id:'a',name:'A',minutesValue:30,stats:{two_pm:2,three_pm:0}}]},{side:'away',name:'V',players:[]}]};
 const story={match_id:'1',home:{name:'H'},away:{name:'V'},events:[made('h','A')]};
 const result=playerEventsFromSeason([game],[story]);
 assert.deepEqual(result.excluded,['1']);assert.equal(result.games,0);assert.deepEqual(result.players,{});
});
test('moments are the player’s own swings for their team, biggest first, and small ones stay out',()=>{
 const game={id:'1',verified:true,date:'2026-10-01',teams:[{side:'home',name:'H',players:[{id:'a',name:'A',minutesValue:30,stats:{two_pm:0,three_pm:0}}]},{side:'away',name:'V',players:[{id:'b',name:'B',minutesValue:30,stats:{two_pm:3,three_pm:0}}]}]};
 const events=[{k:'period',s:'',t:0,w:.5},made('a','B',{w:.4}),made('a','B',{w:.38}),made('a','B',{w:.08})];
 const {players}=playerEventsFromSeason([game],[{match_id:'1',home:{name:'H'},away:{name:'V'},events}]);
 assert.deepEqual(players.b.moments.map(moment=>[moment.from,moment.to]),[[.62,.92],[.5,.6]]);
 assert.equal(players.a.moments.length,0);
});
const box=(id,home,away,scoreHome,scoreAway,points)=>({id,verified:true,date:`2026-10-0${id}`,teams:[{id:home,side:'home',name:home,score:scoreHome,players:[{id:'p',name:'P',minutesValue:20,participated:true,stats:{points,two_pa:10,three_pa:0,fta:0}}]},{id:away,side:'away',name:away,score:scoreAway,players:[]}]});
test('the split matches the box score and every game lands in one group',()=>{
 const games=[box(1,'Oma','Kova',60,90,10),box(2,'Oma','Kova',60,90,20),box(3,'Oma','Kova',60,90,30),box(4,'Oma','Heikko',90,60,1),box(5,'Oma','Heikko',90,60,2),box(6,'Oma','Heikko',90,60,3)];
 const split=opponentSplit(games,'p','women');
 assert.equal(split.enough,true);assert.equal(split.small,true);
 assert.deepEqual(split.upper.opponents,['Kova']);assert.deepEqual(split.lower.opponents,['Heikko']);
 assert.equal(split.upper.points,60);assert.equal(split.lower.points,6);
 assert.equal(split.upper.pointsPer40,40);assert.equal(split.upper.minutesPerGame,20);
});
test('the split on real data adds up to the player’s games',()=>{
 const games=data('men-2026-27-matches.json'),id=games.find(game=>game.verified).teams[0].players.find(player=>player.minutesValue>0).id;
 const split=opponentSplit(games,id,'men'),own=games.filter(game=>game.verified&&game.teams.some(team=>team.players.some(player=>player.id===id&&(player.minutesValue>0||player.participated===true))));
 const points=own.reduce((sum,game)=>sum+game.teams.flatMap(team=>team.players).find(player=>player.id===id).stats.points,0);
 assert.equal(split.upper.games+split.lower.games,own.length);assert.equal(split.upper.points+split.lower.points,points);
});
test('too few games in a group means no split',()=>{
 const split=opponentSplit([box(1,'Oma','Kova',60,90,10),box(2,'Oma','Heikko',90,60,1)],'p','women');
 assert.equal(split.enough,false);
});
const shape=(id,three,rim,usage,assists,rebounds,freeThrows)=>({id,name:id,team:'T',season:'2026-27',games:8,minutes:200,values:{three,rim,usage,assists,rebounds,freeThrows}});
test('similarity reads shape, leaves out the player and gives one row per other player',()=>{
 const rows=[shape('a',60,20,25,10,10,20),shape('b',58,22,12,10,10,20),{...shape('b',10,70,12,10,40,50),season:'2025-26'},shape('c',10,70,25,30,40,50),shape('d',30,40,20,20,20,30)];
 const [a]=buildSimilar(rows);
 assert.equal(rows[a.similar[0].at].id,'b');
 assert.ok(!a.similar.some(row=>rows[row.at].id==='a'));
 assert.equal(a.similar.filter(row=>rows[row.at].id==='b').length,1);
});
test('reasons name what both players share, and say so when nothing stands out',()=>{
 const reasons=similarityReasons({three:1.5,rim:-1,usage:.1,assists:0,rebounds:0,freeThrows:0},{three:1.4,rim:-1.1,usage:-.1,assists:0,rebounds:0,freeThrows:0});
 assert.deepEqual(reasons,[{key:'three',level:'high'},{key:'rim',level:'low'}]);
 assert.equal(reasonText(reasons[0]),'paljon kolmosia');
 assert.ok(similarityReasons({three:.1,rim:0,usage:0,assists:0,rebounds:0,freeThrows:0},{three:.1,rim:0,usage:0,assists:0,rebounds:0,freeThrows:0}).every(reason=>reason.level==='same'));
});
const team=(id,players)=>({id,name:id,players:players.map(player=>({id:player,minutesValue:20}))});
const played=(n,players)=>({id:n,verified:true,date:`2026-10-0${n}`,teams:[team('T',players),team('X',[])]});
test('the Matchup Lab link appears only when there is something to compare',()=>{
 assert.deepEqual(matchupComparison([played(1,['p']),played(2,['p']),played(3,[]),played(4,[])],'p','men','2026-27'),{mode:'appearance',teamId:'T'});
 assert.equal(matchupComparison([played(1,['p']),played(2,['p']),played(3,['p'])],'p','men','2026-27'),null);
 assert.deepEqual(matchupComparison([played(1,['p']),played(2,['p'])],'p','men','2025-26'),{mode:'onoff',teamId:'T'});
 assert.equal(matchupComparison([played(1,['p'])],'p','men','2025-26'),null);
 assert.equal(matchupComparison([played(1,['q'])],'p','men','2026-27'),null);
});
const line=(id,points,rebounds=1)=>({id:'p',name:'P',minutesValue:20,stats:{points,rebounds}});
const statGame=(n,points,extra=[])=>({id:String(n),verified:true,date:`2026-10-0${n}`,teams:[{name:'T',players:[line(n,points),...extra]},{name:'X',players:[]}]});
test('season bests give the average, the best and the newest game that reached it',()=>{
 const bests=seasonBests([statGame(1,10),statGame(2,20),statGame(3,20),{...statGame(4,99),verified:false}],'p');
 const points=bests.find(row=>row.metric.key==='points');
 assert.equal(points.best,20);assert.equal(points.times,2);assert.equal(points.game.id,'3');assert.ok(Math.abs(points.average-50/3)<1e-9);
 const blocks=bests.find(row=>row.metric.key==='blocks');
 assert.equal(blocks.best,null);assert.equal(blocks.game,null);
});
test('season bests match a real season as shown at Basket.fi',()=>{
 const games=data('men-2026-27-matches.json'),id=games.flatMap(game=>game.teams).flatMap(team=>team.players).find(player=>player.name.toLocaleLowerCase('fi')==='mikael aalto').id;
 const best=key=>seasonBests(games,id).find(row=>row.metric.key===key);
 assert.ok(best('points').best>=28);assert.ok(best('rebounds').best>=12);assert.ok(best('plus_minus').best>=35);
});
const leader=(id,points)=>({id,name:id,minutesValue:20,stats:{points}});
test('league records keep a player twice, count ties past the last row and skip unverified games',()=>{
 const game=(n,players,verified=true)=>({id:String(n),verified,date:`2026-10-0${n}`,teams:[{name:'T',players},{name:'X',players:[]}]});
 const {rows,tiedBeyond}=leagueRecords([game(1,[leader('a',40),leader('b',30)]),game(2,[leader('a',35),leader('c',30)]),game(3,[leader('d',30),leader('e',30)]),game(4,[leader('z',99)],false)],'points',3);
 assert.deepEqual(rows.map(row=>[row.player.id,row.value]),[['a',40],['a',35],['d',30]]);
 assert.equal(tiedBeyond,3);
});
test('league records match the box score on real data',()=>{
 const games=data('men-2025-26-matches.json'),{rows}=leagueRecords(games,'points');
 const top=Math.max(...games.filter(game=>game.verified).flatMap(game=>game.teams.flatMap(team=>team.players.filter(player=>player.minutesValue>0||player.participated).map(player=>player.stats.points||0))));
 assert.equal(rows.length,5);assert.equal(rows[0].value,top);
});
test('team age ranks only teams with enough known minutes',()=>{
 const teams={A:{average_age:24,known_minutes_share:1},B:{average_age:28,known_minutes_share:.9},C:{average_age:20,known_minutes_share:AGE_MIN_SHARE-.01}};
 const view=teamAgeView(teams,'B');
 assert.equal(view.youngestRank,2);assert.equal(view.teams,2);assert.equal(view.leagueAverage,26);
 assert.equal(teamAgeView(teams,'C'),null);assert.equal(teamAgeView(undefined,'A'),null);
});
for(const [league,base] of [['men','korisliiga/'],['women','']])test(`no public birth year belongs to someone who may be a minor: ${league}`,()=>{
 const year=new Date().getFullYear();
 for(const season of ['2024-25','2025-26','2026-27'])for(const profile of Object.values(data(`profiles/${league}-${season}.json`).players))if(profile.birth_year)assert.ok(year-profile.birth_year>=19);
 for(const row of Object.values(data(`team-ages/${league}-2026-27.json`).teams))assert.deepEqual(Object.keys(row).sort(),['average_age','known_minutes_share','players','players_known','roster_average_age']);
});
test('the league age list runs from youngest to oldest, shares ranks on ties and leaves out thin teams',()=>{
 const teams={A:{average_age:26,roster_average_age:24,known_minutes_share:1},B:{average_age:24,roster_average_age:27,known_minutes_share:.8},C:{average_age:24,roster_average_age:20,known_minutes_share:1},D:{average_age:19,roster_average_age:19,known_minutes_share:AGE_MIN_SHARE-.01}};
 assert.deepEqual(teamAgeRows(teams).map(row=>[row.name,row.rank]),[['B',1],['C',1],['A',3]]);
 assert.deepEqual(teamAgeRows(teams,'roster_average_age').map(row=>row.name),['C','A','B']);
 assert.deepEqual(teamAgeRows(undefined),[]);
});
test('shot breakdown adds up to the player’s points and weighs the league rate by attempts',()=>{
 const player={points:60,twoPM:22,twoPA:36,threePM:3,threePA:5,ftm:7,fta:14},other={twoPM:0,twoPA:4,threePM:5,threePA:15,ftm:7,fta:7};
 const {rows,points}=shotBreakdown(player,[player,other]);
 assert.equal(points,60);assert.deepEqual(rows.map(row=>row.points),[44,9,7]);
 assert.equal(rows[0].leagueRate,55);assert.equal(rows[1].leagueRate,40);
 assert.equal(shotBreakdown({...player,threePM:0,threePA:0},[{}]).rows[1].rate,null);
});
test('one very weak team does not pull most of the league into the upper half',()=>{
 const games=data('men-2025-26-matches.json'),id=games.flatMap(game=>game.teams.flatMap(team=>team.players)).find(player=>/kahron ross/i.test(player.name)).id;
 const split=opponentSplit(games,id,'men');
 assert.deepEqual(split.upper.opponents,['Kauhajoki','Korihait','KTP-Basket','Salon Vilpas','Tapiolan Honka']);
 assert.equal(split.upper.opponents.length,5);assert.equal(split.lower.opponents.length,6);
 assert.ok(split.lower.opponents.includes('Kataja Basket'),'the middle of eleven goes to the lower half');
 assert.ok(!split.upper.opponents.includes('Helsinki Seagulls')&&!split.lower.opponents.includes('Helsinki Seagulls'));
 assert.deepEqual([split.upper.games,split.lower.games],[17,12]);
});
test('suggested players come from the selected season, one per team before any repeats',()=>{
 const row=(id,team,season='2026-27')=>({id,name:id,team,season});
 const players=[row('a','T1'),row('b','T1'),row('c','T2'),row('d','T3'),row('e','T4','2025-26')];
 const picks=suggestedPlayers(players,'2026-27',2,()=>.5);
 assert.deepEqual(picks.map(p=>p.team),['T1','T2']);
 assert.ok(!suggestedPlayers(players,'2026-27',8).some(p=>p.id==='e'));
 assert.equal(new Set(suggestedPlayers([row('a','T1'),row('a','T1','2025-26')],'2024-25').map(p=>p.id)).size,1);
});
test('a suggestion names a trait only when it really stands out',()=>{
 assert.deepEqual(standoutTrait({similar:[{reasons:[{key:'three',level:'same'}]},{reasons:[{key:'rim',level:'high'}]}]}),{key:'rim',level:'high'});
 assert.equal(standoutTrait({similar:[{reasons:[{key:'three',level:'same'}]}]}),null);
});
test('feature positions place a player among the league, sharing the rank on ties',()=>{
 const rows=[shape('a',10,1,1,1,1,1),shape('b',20,1,1,1,1,1),shape('c',20,1,1,1,1,1),shape('d',30,1,1,1,1,1)];
 const position=featurePositions(rows);
 assert.equal(position(rows[0]).three,12.5);assert.equal(position(rows[1]).three,50);assert.equal(position(rows[3]).three,87.5);
 assert.equal(position(rows[0]).rim,50);
});
