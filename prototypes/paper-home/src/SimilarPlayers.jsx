import {useMemo,useState} from 'react';
import {locale,useI18n} from './i18n';
import {useSeason} from './SeasonContext';
import {LoadingSkeleton,StateCard} from './PageStates';
import {useSimilarPlayers} from './PlayerInsights';
import {goTo,routeHref,slug} from './routing';
import {TeamLogo} from './TeamLogo';
import {FEATURE_LABELS,FEATURE_SHORT,SIMILAR_FEATURES,SIMILAR_MIN_GAMES,SIMILAR_MIN_MINUTES,featurePositions,reasonText,standoutTrait,suggestedPlayers} from './lib/similarPlayers';
import './player-discoveries.css';
import './team-resources.css';
import './player-insights.css';

const RESULTS=8;
const season=value=>value.replace('-','–');
const value=number=>`${Number(number).toLocaleString(locale(),{maximumFractionDigits:1})} %`;
const initialPlayer=()=>new URLSearchParams(location.search).get('player');
const AXIS_ANGLE=index=>-Math.PI/2+index*Math.PI/3;
const axisPoint=(index,level,size)=>{const radius=(size/2-(size>200?44:6))*level/100;return [size/2+radius*Math.cos(AXIS_ANGLE(index)),size/2+radius*Math.sin(AXIS_ANGLE(index))];};
const shapePath=(levels,size)=>SIMILAR_FEATURES.map((key,index)=>axisPoint(index,levels[key],size).map(n=>n.toFixed(1)).join(',')).join(' ');
// The same colours and line styles as the Matchup Lab radar: orange first, dashed blue second.
function ShapeRadar({first,second,labels,lang}){
 const size=labels?320:150;
 const describe=levels=>SIMILAR_FEATURES.map(key=>`${FEATURE_SHORT[key][lang]} ${Math.round(levels[key])}`).join(', ');
 return <svg className={`similar-radar ${labels?'is-large':''}`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={second?`${describe(first)}. ${describe(second)}.`:describe(first)}>
  {[25,50,75,100].map(level=><polygon key={level} points={shapePath(Object.fromEntries(SIMILAR_FEATURES.map(key=>[key,level])),size)} className={level===50?'is-mid':''}/>)}
  {SIMILAR_FEATURES.map((key,index)=>{const [x,y]=axisPoint(index,100,size);return <line key={key} x1={size/2} y1={size/2} x2={x} y2={y}/>;})}
  <polygon className="similar-radar-first" points={shapePath(first,size)}/>
  {second&&<polygon className="similar-radar-second" points={shapePath(second,size)}/>}
  {labels&&SIMILAR_FEATURES.map((key,index)=>{const [x,y]=axisPoint(index,122,size);return <text key={key} x={x} y={y} textAnchor={Math.abs(x-size/2)<4?'middle':x>size/2?'start':'end'} dominantBaseline="middle">{FEATURE_SHORT[key][lang]}</text>;})}
 </svg>;
}
export function SimilarPlayers(){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',say=(fi,en)=>lang==='fi'?fi:en,{leagueId,seasonId,leagueName}=useSeason(),{data,failed}=useSimilarPlayers(leagueId);
 const [query,setQuery]=useState(''),[chosen,setChosen]=useState(()=>{const id=initialPlayer();return id?{id,season:seasonId}:null;});
 const [round,setRound]=useState(0);
 const position=useMemo(()=>featurePositions(data?.players??[]),[data]);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- a new round is what asks for a new draw
 const suggestions=useMemo(()=>data?suggestedPlayers(data.players,seasonId):[],[data,seasonId,round]);
 if(failed)return <StateCard tone="error" title={say('Vertailun lataus epäonnistui.','The comparison could not be loaded.')} description={say('Tarkista yhteys ja lataa sivu uudelleen.','Check your connection and reload the page.')}/>;
 if(!data)return <LoadingSkeleton variant="comparison" label={say('Ladataan vertailua…','Loading comparison…')}/>;
 const seasons=chosen?data.players.filter(row=>row.id===chosen.id).sort((a,b)=>b.season.localeCompare(a.season)):[];
 const selected=seasons.find(row=>row.season===chosen?.season)??seasons[0];
 const search=query.trim().toLocaleLowerCase('fi'),matches=search?data.players.filter(row=>row.name.toLocaleLowerCase('fi').includes(search)).sort((a,b)=>a.name.localeCompare(b.name,'fi')||b.season.localeCompare(a.season)).slice(0,RESULTS):[];
 const choose=row=>{setChosen({id:row.id,season:row.season});setQuery('');const url=new URL(location.href);url.searchParams.set('player',row.id);history.replaceState(history.state,'',url);};
 const profile=row=>routeHref({section:'Pelaajat',playerId:row.id,leagueId,seasonId:row.season});
 const teamProfile=row=>routeHref({section:'Joukkueet',teamId:slug(row.team),leagueId,seasonId:row.season});
 const open=event=>{if(event.metaKey||event.ctrlKey||event.shiftKey)return;event.preventDefault();goTo(event.currentTarget.getAttribute('href'));};
 return <div className="similar-players">
  <header className="similar-heading"><p>{say(`Hae pelaajaa nimellä ja katso, kuka pelaa samalla tavalla. Vertailussa ovat vain sarjan ${leagueName} pelaajat.`,`Search for a player and see who plays the same way. Only ${leagueName} players are compared.`)}</p></header>
  <div className="match-filters"><label><input aria-label={say('Hae pelaajaa','Search for a player')} enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder={say('Pelaajan nimi','Player name')} value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
  {search&&<ul className="similar-results">{matches.length?matches.map(row=><li key={`${row.id}-${row.season}`}><button type="button" onClick={()=>choose(row)}><strong>{row.name}</strong><span>{row.team} · {season(row.season)}</span></button></li>):<li className="similar-none">{say('Ei osumia. Mukana ovat vain minuuttirajan täyttävät pelaajat.','No matches. Only players over the minutes limit are included.')}</li>}</ul>}
  {!selected&&!search&&suggestions.length>0&&<section className="similar-suggestions" aria-label={say('Pelaajia, joista voi aloittaa','Players to start from')}>
   <header className="discovery-header"><div><h3>{say('Kokeile näitä','Try these')}</h3><p>{say('Valitse pelaaja, niin näet kuka pelaa samalla tavalla.','Pick a player to see who plays the same way.')}</p></div><button type="button" className="similar-reroll" onClick={()=>setRound(value=>value+1)}>{say('Arvo uudet','Draw new ones')}</button></header>
   <div className="discovery-grid">{suggestions.map(row=>{const trait=standoutTrait(row);return <article key={`${row.id}-${row.season}`} className="discovery-card watch similar-suggestion">
    <div className="discovery-card-top"><span>{trait?reasonText(trait,lang):say('Tasainen profiili','Even profile')}</span><small>{season(row.season)}</small></div>
    <div className="discovery-identity"><img src="/ppg-silhouette.png" width="44" height="52" alt=""/><div><strong><button type="button" onClick={()=>choose(row)}>{row.name}</button></strong><span><TeamLogo name={row.team}/><a href={teamProfile(row)} onClick={open}>{row.team}</a></span></div></div>
   </article>;})}</div>
  </section>}
  {chosen&&!selected&&<p className="player-insight-empty">{say('Tälle pelaajalle ei ole vertailua: mukana ovat vain minuuttirajan täyttävät kaudet, joilta on heittopaikat.','No comparison for this player: only seasons over the minutes limit with shot locations are included.')}</p>}
  {selected&&<>
   <article className="dash-card similar-hero">
    <div className="similar-hero-main">
     <header className="player-insight-heading"><div className="discovery-identity"><img src="/ppg-silhouette.png" width="44" height="52" alt=""/><div><h3><a href={profile(selected)} onClick={open}>{selected.name}</a></h3><span><TeamLogo name={selected.team}/><a href={teamProfile(selected)} onClick={open}>{selected.team}</a><small className="similar-hero-meta">{season(selected.season)} · {selected.games} {say('ottelua','games')} · {selected.minutes} min</small></span></div></div>
      {seasons.length>1&&<div className="team-resource-tabs" role="group" aria-label={say('Kausi','Season')}>{seasons.map(row=><button key={row.season} type="button" aria-pressed={row.season===selected.season} onClick={()=>choose(row)}>{season(row.season)}</button>)}</div>}</header>
     <dl className="similar-shape">{SIMILAR_FEATURES.map(key=><div key={key}><dt>{FEATURE_LABELS[key][lang]}</dt><dd>{value(selected.values[key])}</dd><span className="similar-position" title={say(`Suurempi kuin ${Math.round(position(selected)[key])} %:lla sarjan pelaajista`,`Higher than ${Math.round(position(selected)[key])} % of the league’s players`)}><i style={{width:`${position(selected)[key]}%`}}/></span></div>)}</dl>
     <p className="similar-note">{say('Palkki näyttää, missä kohtaa sarjan pelaajia luku on.','The bar shows where the number sits among the league’s players.')}</p>
    </div>
    <ShapeRadar lang={lang} first={position(selected)} labels/>
   </article>
   <header className="discovery-header similar-list-header"><div><h3>{say('Pelaa samalla tavalla','Plays the same way')}</h3><p>{say(`Oranssi on ${selected.name}, sininen vertailtava pelaaja.`,`Orange is ${selected.name}, blue is the player compared.`)}</p></div></header>
   <div className="discovery-grid similar-matches">{selected.similar.map(({at,reasons},index)=>{const row=data.players[at];return <article key={`${row.id}-${row.season}`} className="discovery-card watch similar-match">
    <div className="discovery-card-top"><span>#{index+1}</span><small>{season(row.season)}</small></div>
    <div className="discovery-identity"><img src="/ppg-silhouette.png" width="44" height="52" alt=""/><div><strong><a href={profile(row)} onClick={open}>{row.name}</a></strong><span><TeamLogo name={row.team}/><a href={teamProfile(row)} onClick={open}>{row.team}</a></span></div></div>
    <ShapeRadar lang={lang} first={position(selected)} second={position(row)}/>
    <ul className="similar-reasons">{reasons.map(reason=><li key={reason.key}><span>{reasonText(reason,lang)}</span><b><span title={selected.name}><i className="similar-mark is-first" aria-hidden="true"/><span className="sr-only">{selected.name} </span>{value(selected.values[reason.key])}</span><span title={row.name}><i className="similar-mark is-second" aria-hidden="true"/><span className="sr-only">{row.name} </span>{value(row.values[reason.key])}</span></b></li>)}</ul>
   </article>;})}</div>
  </>}
  <details className="player-insight-method similar-method" open><summary>{say('Miten tämä lasketaan','How this is worked out')}</summary><p>{say(`Samankaltaisuus kuvaa pelaamisen muotoa, ei sitä, kuka on parempi. Vertailussa on kuusi lukua: kolmosten osuus heitoista, heitot korin alta (alle 2,5 metriä), käyttöaste, osuus joukkueen syötöistä ja levypalloista kentällä ollessa sekä vapaaheitot heittoa kohden. Jokainen luku suhteutetaan sarjan muihin pelaajiin, ja lähimmät profiilit nousevat listalle. Syyt tulevat samoista luvuista. Mukana ovat pelaajat, joilla on vähintään ${SIMILAR_MIN_GAMES} ottelua ja ${SIMILAR_MIN_MINUTES} minuuttia kaudella.${data.skipped.length?` Kaudelta ${data.skipped.map(season).join(', ')} ei ole tässä sarjassa heittopaikkoja, joten se ei ole mukana.`:''} Eri kausien pelaajia voi olla samalla listalla, ja kausi näkyy nimen vieressä.`,`Similarity describes the shape of a player’s game, not who is better. It uses six numbers: threes as a share of shots, shots at the rim (under 2.5 metres), usage, share of team assists and rebounds while on the floor, and free throws per shot. Each number is scaled against the league’s other players, and the closest profiles make the list. The reasons come from the same numbers. Players need at least ${SIMILAR_MIN_GAMES} games and ${SIMILAR_MIN_MINUTES} minutes in a season.${data.skipped.length?` ${data.skipped.map(season).join(', ')} has no shot locations in this league, so it is left out.`:''} Players from different seasons can share a list, and the season is shown beside the name.`)}</p></details>
 </div>;
}
