import teamColors from '../../source/team-colors.json' with {type:'json'};

// The words and numbers of a game replay, built from its data file. They say what happened, never why.
// Only a finished game is 0 or 100 %: the model can be very sure, but it is never certain before the end.
export const wpPercent=p=>p===0||p===1?p*100:Math.min(99,Math.max(1,Math.round(p*100)));
const pct=p=>`${wpPercent(p)} %`;
const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
// Weighted RGB distance: close enough to how different two colours look, and it needs no colour library.
const colorDistance=(a,b)=>{const [ar,ag,ab]=channels(a),[br,bg,bb]=channels(b),red=(ar+br)/2;return Math.sqrt((2+red/256)*(ar-br)**2+4*(ag-bg)**2+(2+(255-red)/256)*(ab-bb)**2);};
const inkOn=hex=>{const [r,g,b]=channels(hex);return (.299*r+.587*g+.114*b)>150?'#111113':'#ffffff';};
const SAME_LOOK=140,CLASH=['#e8e8ea','#df945b'];
// Each team plays in its own colour. When two look alike the away team changes, as a kit would.
export function gameColors(home,away){
 const first=teamColors[home]??'#c9773a';let second=teamColors[away]??'#3f8cc4';
 if(colorDistance(first,second)<SAME_LOOK)second=CLASH.find(color=>colorDistance(first,color)>=SAME_LOOK);
 return {home:first,away:second,homeInk:inkOn(first),awayInk:inkOn(second)};
}
export const clockText=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export const periodLabel=(period,lang)=>period>4?(lang==='fi'?(period>11?`JA${period-10}`:'JA'):(period>11?`OT${period-10}`:'OT')):(lang==='fi'?`${period}. nelj.`:`Q${period}`);
export const shortName=name=>{const parts=(name||'').split(' ').filter(Boolean);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:name||'';};
const SHOTS={'2pt':2,'3pt':3,free_throw:1};
const WORDS={
 fi:{'2pt':'Kori','3pt':'Kolmonen',free_throw:'Vapaaheitto',miss:'Ohi',defensive_rebound:'Levypallo',offensive_rebound:'Hyökkäyslevy',block:'Blokki',assist:'Syöttö',steal:'Riisto',turnover:'Menetys',foul:'Virhe',technical:'Tekninen virhe',unsportsmanlike:'Epäurheilijamainen'},
 en:{'2pt':'Bucket','3pt':'Three',free_throw:'Free throw',miss:'Miss',defensive_rebound:'Rebound',offensive_rebound:'Off. rebound',block:'Block',assist:'Assist',steal:'Steal',turnover:'Turnover',foul:'Foul',technical:'Technical foul',unsportsmanlike:'Unsportsmanlike'},
};
const LINES={
 fi:{'2pt':['teki kahden pisteen korin','heitti kahden pisteen heiton ohi'],'3pt':['upotti kolmosen','heitti kolmosen ohi'],free_throw:['teki vapaaheiton','heitti vapaaheiton ohi'],defensive_rebound:'otti levypallon',offensive_rebound:'otti hyökkäyslevyn',block:'blokkasi heiton',assist:'antoi korisyötön',steal:'riisti pallon',turnover:'menetti pallon',foul:'teki virheen'},
 en:{'2pt':['made a two-pointer','missed a two-pointer'],'3pt':['hit a three','missed a three'],free_throw:['made a free throw','missed a free throw'],defensive_rebound:'took the rebound',offensive_rebound:'took an offensive rebound',block:'blocked the shot',assist:'made an assist',steal:'stole the ball',turnover:'lost the ball',foul:'committed a foul'},
};

// The flag on the court: a big word, and the player under it. Null when nothing visible happened.
export function eventFlag(event,lang){
 if(!event||event.k==='period')return null;
 const words=WORDS[lang];
 if(event.k in SHOTS)return event.m?{big:`+${SHOTS[event.k]}`,tag:words[event.k],name:shortName(event.n),tone:'score'}:{big:words.miss,tag:words[event.k],name:shortName(event.n),tone:'miss'};
 const foul=event.k==='foul'&&words[event.st];
 const word=foul||words[event.k];
 return word?{big:word,name:shortName(event.n),tone:'play'}:null;
}
// A flag near the edge of the court opens inward, so a long word is not cut off. Across a phone's upright court only the side matters.
export const flagAlign=(x,upright=false)=>{if(upright)return x<24?'start':x>76?'end':'middle';return x<8?'start':x>92?'end':'middle';};
export function eventLine(event,lang,teams){
 if(!event||event.k==='period')return '';
 const text=LINES[lang][event.k];if(!text)return '';
 const verb=Array.isArray(text)?text[event.m?0:1]:text,who=event.n||teams[event.s];
 const extra=event.as?(lang==='fi'?` (syöttö: ${event.as})`:` (assist: ${event.as})`):event.lost?(lang==='fi'?` (menetys: ${event.lost})`:` (from ${event.lost})`):'';
 return `${who} ${verb}${extra}`;
}
// Where the action of an event is, in percent of the full court. A shot has its real place; the rest are placed by end.
export function eventPlace(event,story){
 const homeEnd=story.ends[event.p]??'L',flip=end=>end==='L'?'R':'L',teamEnd=event.s==='h'?homeEnd:flip(homeEnd);
 const attack=event.k==='defensive_rebound'||event.k==='block'||event.k==='steal'?flip(teamEnd):teamEnd;
 if(event.x!==undefined)return {x:event.x,y:event.y,end:event.x<50?'L':'R',exact:true};
 const depth=event.k==='free_throw'?20.7:event.k.endsWith('rebound')?9:24;
 return {x:attack==='L'?depth:100-depth,y:50,end:attack,exact:false};
}
// Everything counted so far: each player's and team's line at this moment of the game.
export function statsAt(events,index){
 const blank=()=>({players:{},fgm:0,fga:0,tpm:0,tpa:0,reb:0,ast:0,tov:0,stl:0});
 const out={h:blank(),a:blank()},player=(side,name)=>out[side].players[name]??={name,pts:0,reb:0,ast:0};
 for(let i=0;i<=index&&i<events.length;i++){
  const event=events[i],team=out[event.s];if(!team)continue;
  if(event.k in SHOTS){
   if(event.k!=='free_throw'){team.fga++;if(event.m)team.fgm++;if(event.k==='3pt'){team.tpa++;if(event.m)team.tpm++;}}
   if(event.n){const row=player(event.s,event.n);if(event.m)row.pts+=SHOTS[event.k];}
   if(event.as){player(event.s,event.as).ast++;team.ast++;}
  }else if(event.k.endsWith('rebound')){team.reb++;if(event.n)player(event.s,event.n).reb++;}
  else if(event.k==='steal'){team.stl++;out[event.s==='h'?'a':'h'].tov++;}
  else if(event.k==='turnover')team.tov++;
  else if(event.k==='assist'){team.ast++;if(event.n)player(event.s,event.n).ast++;}
 }
 return out;
}
export const topPlayers=(team,count=5)=>Object.values(team.players).sort((a,b)=>b.pts-a.pts||b.reb+b.ast-a.reb-a.ast||a.name.localeCompare(b.name)).slice(0,count);
export const indexAt=(events,t)=>{let low=0,high=events.length-1;while(low<high){const mid=Math.ceil((low+high)/2);if(events[mid].t<=t)low=mid;else high=mid-1;}return low;};
// The clock runs between events, and never ahead of the next one.
export function clockAt(events,index,t){
 const now=events[index],next=events[index+1];
 const run=Math.max(0,now.c-(t-now.t));
 return next&&next.p===now.p?Math.max(next.c,run):run;
}
export function storyChapters(story,lang){
 const say=(fi,en)=>lang==='fi'?fi:en,team=side=>story[side].name;
 const favourite=story.pregame_home_wp>=.5?'home':'away',favouriteWp=favourite==='home'?story.pregame_home_wp:1-story.pregame_home_wp;
 const chapters=[{at:0,title:say('Ennen ottelua','Before the game'),text:say(`Aiempien tulosten ja kotikentän perusteella ${team(favourite)} oli suosikki, ${pct(favouriteWp)}.`,`Based on earlier results and home court, ${team(favourite)} were favourites at ${pct(favouriteWp)}.`)}];
 for(const leg of story.chapters){
  const side=leg.gaining,own=side==='home'?leg.home_points:leg.away_points,other=side==='home'?leg.away_points:leg.home_points;
  const from=side==='home'?leg.wp_from:1-leg.wp_from,to=side==='home'?leg.wp_to:1-leg.wp_to;
  const run=own>=4?say(`${team(side)} teki jakson ${own}–${other}.`,`${team(side)} went on a ${own}–${other} run.`):'';
  const chance=say(`Sen voittotodennäköisyys nousi ${pct(from)} → ${pct(to)}.`,`${run?'Their':`${team(side)}’s`} win probability rose ${pct(from)} → ${pct(to)}.`);
  const points=leg.leader?.points;
  const leader=leg.leader?.name&&points>=4?say(`${leg.leader.name} teki ${points} pistettä.`,`${leg.leader.name} scored ${points}.`):'';
  chapters.push({at:leg.from,title:`${periodLabel(leg.period_to,lang)} ${clockText(leg.clock_to)} · ${leg.score_to[0]}–${leg.score_to[1]}`,text:[run||say(`${team(side)} sai käänteen.`,''),chance,leader].filter(Boolean).join(' ')});
 }
 const play=story.biggest_play,winner=story.home.score>story.away.score?'home':'away',shot=say({'2pt':'kahden pisteen heitto','3pt':'kolmonen',free_throw:'vapaaheitto'},{'2pt':'two-pointer','3pt':'three-pointer',free_throw:'free throw'})[play.type];
 const big=Math.abs(play.wp_to-play.wp_from)>=.05;
 const swing=big?say(` Suurin yksittäinen käänne: ${shot}, ${play.player} (${periodLabel(play.period,'fi')} ${clockText(play.clock)}). Kotijoukkueen voittotodennäköisyys ${pct(play.wp_from)} → ${pct(play.wp_to)}.`,` The biggest single swing: ${shot}, ${play.player} (${periodLabel(play.period,'en')} ${clockText(play.clock)}). Home win probability ${pct(play.wp_from)} → ${pct(play.wp_to)}.`):'';
 const calm=story.chapters.length?'':say(' Ottelussa ei ollut isoja käänteitä.',' The game had no big turns.');
 chapters.push({at:story.duration,title:say(`Lopputulos ${story.home.score}–${story.away.score}`,`Final ${story.home.score}–${story.away.score}`),text:say(`${team(winner)} voitti.`,`${team(winner)} won.`)+calm+swing});
 return chapters;
}
