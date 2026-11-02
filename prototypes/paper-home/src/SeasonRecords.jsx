import {useMemo,useState} from 'react';
import {locale,useI18n} from './i18n';
import {useSeason} from './SeasonContext';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import {RECORD_METRICS,leagueRecords} from './lib/gameBests';
import './player-discoveries.css';
import './team-resources.css';
import './player-insights.css';

const day=value=>value?new Date(value).toLocaleDateString(locale()):'—';
// Built from the same section and cards as Kauden yllättäjät, right below it on the page.
export function SeasonRecords({games,link,onOpenMatch}){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',say=(fi,en)=>lang==='fi'?fi:en,{leagueId,seasonId}=useSeason();
 const metrics=useMemo(()=>RECORD_METRICS.filter(metric=>leagueRecords(games,metric.key,1).rows.length),[games]);
 const [chosen,setChosen]=useState('points'),active=metrics.find(metric=>metric.key===chosen)??metrics[0];
 const records=useMemo(()=>active?leagueRecords(games,active.key):null,[games,active]);
 if(!records?.rows.length)return null;
 const top=records.rows[0].value;
 return <section className="player-discoveries season-records" aria-label={say('Kauden parhaat ottelut','Best games of the season')}>
  <header className="discovery-header"><div><h3>{say('Kauden parhaat ottelut','Best games of the season')}</h3><p>{say('Sarjan suurimmat yksittäiset suoritukset.','The league’s biggest single performances.')}</p></div>
   <div className="team-resource-tabs" role="group" aria-label={say('Tilasto','Stat')}>{metrics.map(metric=><button key={metric.key} type="button" aria-pressed={metric.key===active.key} onClick={()=>setChosen(metric.key)}>{metric[lang]}</button>)}</div></header>
  <div className="discovery-grid season-record-grid">{records.rows.map((row,index)=><article key={`${row.game.id}-${row.player.id}`} className={`discovery-card season-record ${row.value===top?'is-top':''}`}>
   <div className="discovery-card-top"><span>#{index+1}</span><small>{day(row.game.date)}</small></div>
   <div className="discovery-identity"><img src="/ppg-silhouette.png" width="44" height="52" alt=""/><div><strong>{link('Pelaajat',row.player.id,row.player.name)}</strong><span><TeamLogo name={row.team.name}/>{link('Joukkueet',slug(row.team.name),row.team.name)}</span></div></div>
   <div className="discovery-stat"><strong>{row.value}</strong><span>{active[lang].toLocaleLowerCase(lang)}</span></div>
   <a className="season-record-game" href={routeHref({section:'Ottelut',matchId:row.game.id,leagueId,seasonId})} onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onOpenMatch(row.game.id);}}}>{say('vastassa','against')} {row.opponent.name}</a>
  </article>)}</div>
  {records.tiedBeyond>0&&<p className="match-method">{say(`Viimeisen kortin lukemaan ylsi lisäksi ${records.tiedBeyond} muuta suoritusta.`,`${records.tiedBeyond} more performances reached the same number as the last card.`)}</p>}
  <p className="match-method">{say('Mukana ovat valitun kauden tarkistetut sarjaottelut, ei pudotuspelejä.','Includes the selected season’s verified league games, not the playoffs.')}</p>
 </section>;
}
