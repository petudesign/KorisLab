import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {seasonTeams,teamSeasonSummary} from '../src/lib/teamProfiles.js';
const seasons=JSON.parse(fs.readFileSync(new URL('../source/seasons.json',import.meta.url)));
const logos=JSON.parse(fs.readFileSync(new URL('../source/team-logos.json',import.meta.url)));
for(const [league,rows] of Object.entries(seasons))for(const [year,season] of Object.entries(rows))test(`${league} ${year}: every scheduled and statistical team has a real logo`,()=>{
 const games=JSON.parse(fs.readFileSync(new URL('../public'+season.matchesUrl,import.meta.url)));
 const teams=seasonTeams(season,games);
 assert.equal(new Set(teams.map(t=>t.name)).size,teams.length);
 for(const team of teams){
  const logo=logos[team.name];assert.ok(logo?.src,team.name);
  assert.ok(fs.existsSync(new URL('../public'+logo.src,import.meta.url)));
  const [w,h,x,y,right,bottom]=logo.bounds;assert.ok(x>=0&&y>=0&&right<=w&&bottom<=h&&right>x&&bottom>y);
  const summary=teamSeasonSummary(games,team.name);
  assert.equal(summary.games,team.games);
  assert.equal(summary.wins+summary.losses,summary.games);
  if(summary.games)assert.equal(summary.pointsPerGame,summary.pointsFor/summary.games);
  assert.ok(summary.recent.length<=5);
 }
});
test('schedule-only teams remain visible and future scores never become statistical zeroes',()=>{
 const season={aggregate:{teams:[{name:'A',source_team_id:'a',games:1}]}};
 const games=[{id:1,date:'2026-10-01',verified:true,teams:[{id:'a',name:'A',score:80},{id:'b',name:'B',score:70}]},{id:2,date:'2026-11-01',verified:false,teams:[{id:'a',name:'A',score:null},{id:'c',name:'C',score:null}]}];
 assert.deepEqual(seasonTeams(season,games).map(t=>t.name),['A','B','C']);
 assert.equal(teamSeasonSummary(games,'A').pointsPerGame,80);
 assert.equal(teamSeasonSummary(games,'C').pointsPerGame,null);
});
