import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import PauseRounded from '@mui/icons-material/PauseRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import ReplayRounded from '@mui/icons-material/ReplayRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import {t as translate,useI18n} from './i18n';
import {TeamLogo} from './TeamLogo';
import {clockAt,clockText,eventFlag,eventLine,eventPlace,flagAlign,gameColors,indexAt,leadChanges,periodLabel,statsAt,storyChapters,topPlayers,wpPercent} from './lib/gameStory';
import stories from '../source/game-stories.json';
import './game-story.css';

const storyIds=Object.fromEntries(Object.entries(stories).map(([scope,ids])=>[scope,new Set(ids)]));
export const hasStory=(leagueId,seasonId,matchId)=>Boolean(storyIds[`${leagueId}-${seasonId}`]?.has(String(matchId)));
const SPEEDS=[4,8,16];
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// FIBA court in tenths of a metre, one end drawn and mirrored. Lines only: the data has no player positions.
function CourtEnd(){
 const arc=67.5,rim=15.75,corner=9,cornerEnd=rim+Math.sqrt(arc*arc-(75-corner)**2);
 return <g className="court-lines">
  <rect x="0" y="50.5" width="58" height="49"/>
  <path d={`M0 ${corner}H${cornerEnd.toFixed(1)}A${arc} ${arc} 0 0 1 ${cornerEnd.toFixed(1)} ${150-corner}H0`}/>
  <circle cx="58" cy="75" r="18"/>
  <path d={`M${rim} 62.5A12.5 12.5 0 0 1 ${rim} 87.5`}/>
  <path className="court-rim" d="M12 66V84"/><circle className="court-rim" cx={rim} cy="75" r="2.3"/>
 </g>;
}
const shotX=x=>x/100*280,shotY=y=>y/100*150;
const UPRIGHT='(max-width:820px)';
// A phone is tall, so its court stands upright: the whole court stays in view without shrinking to a strip.
function useUprightCourt(){
 const [upright,setUpright]=useState(()=>typeof matchMedia==='function'&&matchMedia(UPRIGHT).matches);
 useEffect(()=>{const query=matchMedia(UPRIGHT),update=()=>setUpright(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 return upright;
}
const Court=memo(function Court({story,index,lang}){
 const upright=useUprightCourt();
 const event=story.events[index],period=event.p,flag=eventFlag(event,lang);
 const place=useMemo(()=>{for(let i=index;i>=0;i--){const e=story.events[i];if(e.s)return eventPlace(e,story);}return {x:50,y:50,end:story.ends[period]??'L'};},[index,story,period]);
 const here=event.s?eventPlace(event,story):null;
 const shots=[];
 for(let i=index;i>=0&&story.events[i].p===period;i--){const e=story.events[i];if(e.x!==undefined)shots.push({...e,age:event.t-e.t,i});}
 const latestShot=event.x!==undefined?event:null,rimX=latestShot&&(latestShot.x<50?15.75:264.25);
 return <div className="story-camera"><div className="story-pan"><div className="story-court">
  <svg viewBox={upright?'0 0 150 280':'0 0 280 150'} aria-hidden="true"><g transform={upright?'translate(0 280) rotate(-90)':undefined}>
   <rect className="court-floor" x="0" y="0" width="280" height="150"/>
   <rect className="court-glow" x={place.end==='L'?0:140} y="0" width="140" height="150" fill={`url(#court-glow-${place.end})`}/>
   <defs><radialGradient id="court-glow-L" cx="0.1" cy="0.5" r="0.9"><stop offset="0" stopColor="#fff" stopOpacity=".13"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient><radialGradient id="court-glow-R" cx="0.9" cy="0.5" r="0.9"><stop offset="0" stopColor="#fff" stopOpacity=".13"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient></defs>
   <g className="court-lines"><rect x="0" y="0" width="280" height="150"/><path d="M140 0V150"/><circle cx="140" cy="75" r="18"/></g>
   <CourtEnd/><g transform="translate(280 0) scale(-1 1)"><CourtEnd/></g>
   {shots.reverse().map(shot=>{const size=shot.i===index?3.1:2.2;return <circle key={shot.i} cx={shotX(shot.x)} cy={shotY(shot.y)} r={size} className={`court-shot side-${shot.s} ${shot.m?'is-made':'is-miss'} ${shot.age>90?'is-old':''}`}/>;})}
   {latestShot&&<g key={index}><path pathLength="1" className="court-flight" d={`M${shotX(latestShot.x)} ${shotY(latestShot.y)}L${rimX} 75`}/>{latestShot.m&&<circle cx={rimX} cy="75" r="5" className={`court-splash side-${latestShot.s}`}/>}</g>}
  </g></svg>
  {flag&&here&&<div key={index} className={`story-flag tone-${flag.tone} side-${event.s} align-${flagAlign(upright?here.y:here.x,upright)} ${flag.big.length>9?'is-long':''}`} style={upright?{left:`${Math.min(92,Math.max(8,here.y))}%`,top:`${Math.min(92,Math.max(22,100-here.x))}%`,'--far':1-Math.min(92,Math.max(22,100-here.x))/100}:{left:`${Math.min(92,Math.max(8,here.x))}%`,top:`${Math.min(82,Math.max(16,here.y))}%`}}><div className="story-flag-inner"><strong>{flag.big}</strong>{flag.tag&&<em>{flag.tag}</em>}{flag.name&&<span>{flag.name}</span>}</div></div>}
 </div></div></div>;
});

const Table=memo(function Table({name,team,active,say,side}){
 return <div className={`story-table side-${side}`}><table><thead><tr><th scope="col">{name}</th><th scope="col"><abbr title={say('Pisteet','Points')}>{say('P','PTS')}</abbr></th><th scope="col"><abbr title={say('Levypallot','Rebounds')}>{say('L','REB')}</abbr></th><th scope="col"><abbr title={say('Syötöt','Assists')}>{say('S','AST')}</abbr></th></tr></thead>
  <tbody>{topPlayers(team).map(row=><tr key={row.name} className={row.name===active?'is-active':''}><th scope="row">{row.name}</th><td>{row.pts}</td><td>{row.reb}</td><td>{row.ast}</td></tr>)}</tbody></table></div>;
});

const W=1000,H=68;
const Timeline=memo(function Timeline({story,t,onSeek,chapters,say}){
 const {events,duration}=story,x=time=>time/duration*W,y=p=>4+(1-p)*(H-8);
 const line=useMemo(()=>[`M0 ${y(story.pregame_home_wp)}`,...events.map(e=>`L${x(e.t).toFixed(1)} ${y(e.w).toFixed(1)}`)].join(''),[events,duration]);// eslint-disable-line
 const area=`${line}L${W} ${y(.5)}L0 ${y(.5)}Z`,ticks=[600,1200,1800,2400].filter(s=>s<duration);
 return <div className="story-timeline">
  <div className="story-timeline-labels"><span>{story.home.name} {say('voittaa','win')}</span><span>{story.away.name} {say('voittaa','win')}</span></div>
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
   <defs><clipPath id="wp-top"><rect width={W} height={y(.5)}/></clipPath><clipPath id="wp-bot"><rect y={y(.5)} width={W} height={H}/></clipPath><clipPath id="wp-past"><rect width={x(t)} height={H}/></clipPath></defs>
   {ticks.map(s=><line key={s} x1={x(s)} x2={x(s)} y1="0" y2={H} className="wp-tick" vectorEffect="non-scaling-stroke"/>)}
   <line x1="0" x2={W} y1={y(.5)} y2={y(.5)} className="wp-mid" vectorEffect="non-scaling-stroke"/>
   <path d={line} className="wp-ghost" vectorEffect="non-scaling-stroke"/>
   <g clipPath="url(#wp-past)"><path d={area} className="wp-home" clipPath="url(#wp-top)"/><path d={area} className="wp-away" clipPath="url(#wp-bot)"/><path d={line} className="wp-line" vectorEffect="non-scaling-stroke"/></g>
   {chapters.slice(1,-1).map(c=><line key={c.at} x1={x(c.at)} x2={x(c.at)} y1="0" y2="8" className="wp-mark" vectorEffect="non-scaling-stroke"/>)}
   <line x1={x(t)} x2={x(t)} y1="0" y2={H} className="wp-head" vectorEffect="non-scaling-stroke"/>
  </svg>
  <input type="range" min="0" max={duration} step="1" value={t} onChange={e=>onSeek(Number(e.target.value))} aria-label={say('Kohta ottelussa','Moment in the game')} aria-valuetext={say('Ottelun kohta','Game moment')}/>
 </div>;
});

export function GameStory({leagueId,seasonId,matchId}){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',say=useCallback((fi,en)=>lang==='fi'?fi:en,[lang]);
 const [story,setStory]=useState(null),[failed,setFailed]=useState(false),[t,setT]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(8),last=useRef(0);
 useEffect(()=>{let live=true;fetch(`/data/stories/${leagueId}-${seasonId}-${matchId}.json`).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(live)setStory(d);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[leagueId,seasonId,matchId]);
 useEffect(()=>{
  if(!playing||!story)return;
  let frame;last.current=performance.now();
  const tick=now=>{const delta=(now-last.current)/1000*speed;last.current=now;setT(value=>{const next=Math.min(story.duration,value+delta);if(next>=story.duration)setPlaying(false);return next;});frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,speed,story]);
 const chapters=useMemo(()=>story?storyChapters(story,lang):[],[story,lang]);
 const leads=useMemo(()=>story?leadChanges(story.events):[],[story]);
 const index=story?indexAt(story.events,t):0,stats=useMemo(()=>story?statsAt(story.events,index):null,[story,index]);
 const seek=useCallback(value=>{setT(value);setPlaying(false);},[]);
 if(failed)return <p className="story-note">{say('Tarinaa ei voitu ladata.','The story could not be loaded.')}</p>;
 if(!story)return <div className="story-stage is-loading" aria-busy="true"/>;
 const event=story.events[index],teams={h:story.home.name,a:story.away.name},period=event.p,ended=t>=story.duration;
 const started=event.s||index>0,active=chapters.reduce((found,chapter,i)=>chapter.at<=t?i:found,0);
 const nextLead=leads.find(at=>at>t);
 const jump=at=>{setT(at);if(at<story.duration&&!reducedMotion())setPlaying(true);else setPlaying(false);};
 const periods=[...new Set(story.events.map(e=>e.p))],periodStart=p=>story.events.find(e=>e.p===p).t;
 const line=eventLine(event,lang,teams),rows=[[say('Heitot','FG'),s=>`${s.fgm}/${s.fga}`],[say('Kolmoset','3P'),s=>`${s.tpm}/${s.tpa}`],[say('Levypallot','Rebounds'),s=>s.reb],[say('Syötöt','Assists'),s=>s.ast],[say('Menetykset','Turnovers'),s=>s.tov]];
 const homeWp=wpPercent(event.w),awayWp=100-homeWp;
 const colors=gameColors(story.home.name,story.away.name);
 return <div className="story" style={{'--story-home':colors.home,'--story-away':colors.away,'--story-home-ink':colors.homeInk,'--story-away-ink':colors.awayInk}}>
  <header className="story-heading"><h3>{translate('Ottelun tarina')}</h3><p>{say('Katso ottelu tapahtuma kerrallaan tai hyppää suoraan käänteisiin.','Watch the game play by play or jump straight to the turns.')}</p></header>
  <section className="story-stage" aria-label={say('Ottelun toisto','Game replay')}>
   <header className="story-score">
    <div className="story-team"><TeamLogo name={story.home.name} className="story-logo" decorative/><span>{story.home.name}</span></div>
    <div className="story-center">
     <div className="story-points side-h"><strong>{event.h}</strong><small>{homeWp} %</small></div>
     <div className="story-clock"><span>{say('Toisto','Replay')}</span><b>{periodLabel(period,lang)} {clockText(clockAt(story.events,index,t))}</b><small>{say('voitto-%','win %')}</small></div>
     <div className="story-points side-a"><strong>{event.a}</strong><small>{awayWp} %</small></div>
    </div>
    <div className="story-team is-away"><span>{story.away.name}</span><TeamLogo name={story.away.name} className="story-logo" decorative/></div>
   </header>
   <div className="story-floor">
    <div className="story-tables"><Table name={story.home.name} team={stats.h} active={event.s==='h'?event.n:null} say={say} side="h"/><Table name={story.away.name} team={stats.a} active={event.s==='a'?event.n:null} say={say} side="a"/></div>
    <Court story={story} index={index} lang={lang}/>
   </div>
   <p className="story-line" aria-live={playing?'off':'polite'}>{line?<><i className={`side-${event.s}`}/>{line}</>:started?'':say('Paina toistoa tai siirry kohtaan, jossa johtaja vaihtuu.','Press play or jump to where the lead changes.')}</p>
   <Timeline story={story} t={t} onSeek={seek} chapters={chapters} say={say}/>
   <div className="story-controls">
    <button type="button" className="story-play" aria-label={playing?say('Tauko','Pause'):ended?say('Toista alusta','Replay from start'):say('Toista','Play')} onClick={()=>{if(ended){setT(0);setPlaying(true);}else setPlaying(!playing);}}>{playing?<PauseRounded/>:ended?<ReplayRounded/>:<PlayArrowRounded/>}</button>
    <label className="story-select"><span className="sr-only">{say('Jakso','Period')}</span><select value={period} onChange={e=>seek(periodStart(Number(e.target.value)))}>{periods.map(p=><option key={p} value={p}>{periodLabel(p,lang)}</option>)}</select></label>
    <label className="story-select"><span className="sr-only">{say('Nopeus','Speed')}</span><select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{SPEEDS.map(s=><option key={s} value={s}>{s}×</option>)}</select></label>
    <button type="button" className="story-next" disabled={nextLead===undefined} onClick={()=>seek(nextLead)}><SkipNextRounded/><span className="is-wide">{say('Seuraava käänne','Next turn')}</span><span className="is-narrow">{say('Käänne','Turn')}</span></button>
   </div>
  </section>
  <div className="story-below">
   <section className="story-chapters"><h3>{say('Käänteet','The turns')}</h3><ol>{chapters.map((chapter,i)=><li key={i} className={i===active?'is-active':''}><button type="button" onClick={()=>jump(chapter.at)} aria-current={i===active?'step':undefined}><b>{chapter.title}</b><span>{chapter.text}</span></button></li>)}</ol></section>
   <section className="story-compare"><h3>{say('Joukkueet nyt','Teams now')}</h3><table><thead><tr><th scope="col">{story.home.name}</th><th scope="col"><span className="sr-only">{say('Tilasto','Stat')}</span></th><th scope="col">{story.away.name}</th></tr></thead><tbody>{rows.map(([label,read])=><tr key={label}><td>{read(stats.h)}</td><th scope="row">{label}</th><td>{read(stats.a)}</td></tr>)}</tbody></table>
    <p className="story-note">{say('Heitot ovat oikeilla paikoillaan kentällä: täytetty piste on sisään, rengas ohi. Muut tapahtumat näytetään sillä kenttäpuoliskolla, jolla ne tapahtuivat, koska niillä ei ole sijaintia eikä pelaajien liikkeistä ole dataa. Taulukot näyttävät tähän asti eniten pisteitä tehneet.','Shots are in their real places: filled is made, ring is missed. Other events are shown on their half of the court, because they have no location and the data has no player movement. The tables show the top scorers so far.')}</p>
    <p className="story-note">{say('Voittotodennäköisyys lasketaan tilanteesta, ajasta ja joukkueiden aiemmista tuloksista. Malli ei tiedä, kenellä pallo on, eikä näe virheitä tai kentällisiä. Se lukittiin kaudella 2024–25 ja testattiin kerran kaudella 2025–26, jolloin se oli miesten sarjassa kotijoukkueen suuntaan liian varma. Prosentit ovat suuntaa antavia.','Win probability comes from the score, the clock and earlier results. The model does not know who has the ball, fouls or lineups. It was locked on 2024–25 and tested once on 2025–26, where it was too sure of home teams in the men’s league. The percentages are indicative.')}</p>
   </section>
  </div>
 </div>;
}
