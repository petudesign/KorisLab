import {useId,useMemo,useState} from 'react';
import {getSeason,seasonIds,useSeason} from './SeasonContext';
import {useMatches} from './useMatches';
import {aggregateSeasonPlayers} from './lib/playerStats';
import {matchupRecords} from './lib/matchupRecords';
import {playersToWatch,seasonOutliers} from './lib/playerDiscoveries';
import {TeamLogo} from './TeamLogo';
import {t as translate,locale} from './i18n';
import './player-discoveries.css';

const fmt=n=>n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
export function PlayerDiscoveries({players,link}){
 const {leagueId,seasonId}=useSeason();
 const previousId=seasonIds[seasonIds.indexOf(seasonId)+1];
 const previousSeason=previousId?getSeason(leagueId,previousId):null;
 const previous=useMatches(previousSeason?.matchesUrl);
 const baseline=useMemo(()=>previous.games?aggregateSeasonPlayers(matchupRecords(previous.games)):[],[previous.games]);
 const outliers=useMemo(()=>seasonOutliers(players,baseline),[players,baseline]);
 const watch=useMemo(()=>playersToWatch(players),[players]);
 const [view,setView]=useState(previousId?'outliers':'watch');
 const panelId=useId(),selection=view==='outliers'?outliers:watch;
 const keyNavigation=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const next=e.key==='Home'?'outliers':e.key==='End'?'watch':view==='outliers'?'watch':'outliers';
  setView(next);e.currentTarget.parentElement.querySelector(`[data-view="${next}"]`).focus();
 };
 return <section className="player-discoveries" aria-label={translate('Pelaajanostot datasta')}>
  <header className="discovery-header"><div><h3>{translate(view==='outliers'?'Kauden yllättäjät':'Pidä silmällä')}</h3><p>{translate(view==='outliers'?'Mikä on muuttunut edellisestä kaudesta?':'Vahvuuksia, jotka jäävät pistekeskiarvon varjoon.')}</p></div>
   <div className="discovery-tabs" role="tablist" aria-label={translate('Pelaajanostojen näkymä')}>{[['outliers','Kauden yllättäjät'],['watch','Pidä silmällä']].map(([key,label])=><button key={key} id={`${panelId}-${key}`} data-view={key} role="tab" aria-selected={view===key} aria-controls={panelId} tabIndex={view===key?0:-1} onKeyDown={keyNavigation} onClick={()=>setView(key)}>{translate(label)}</button>)}</div>
  </header>
  <div key={view} id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${view}`}>
   {view==='outliers'&&previousId&&!previous.games&&!previous.error?<p className="discovery-empty" role="status">{translate('Ladataan edellisen kauden vertailua…')}</p>:view==='outliers'&&previous.error?<p className="discovery-empty">{translate('Edellisen kauden vertailua ei voitu ladata.')} <button onClick={previous.retry}>{translate('Yritä uudelleen')}</button></p>:selection.rows.length?<div className="discovery-grid">{selection.rows.map(row=><article className={`discovery-card ${row.metric==='minutes'?'role-change':view==='watch'?'watch':row.direction}`} key={row.player.id}>
    <div className="discovery-card-top"><span>{translate(row.trait)}</span><small>{translate(selection.qualification.early?'Alkukauden signaali':'Kauden aineisto')}</small></div>
    <div className="discovery-identity"><img src="/ppg-silhouette.png" width="44" height="52" alt=""/><div><strong>{link('Pelaajat',row.player.id,row.player.name)}</strong><span><TeamLogo name={row.player.team}/>{row.player.team}</span></div></div>
    <div className="discovery-stat"><strong>{fmt(view==='outliers'?row.current:row.value)}</strong><span>{translate(row.unit)}</span></div>
    <p className="discovery-metric">{translate(row.label)}</p>
    {view==='outliers'?<div className="discovery-comparison"><span>{previousId.replace('-','–')} <b>{fmt(row.prior)}</b></span><strong className="discovery-delta">{row.delta>0?'+':''}{fmt(row.delta)} <small>{translate(row.unit)}</small></strong></div>:<div className="discovery-comparison"><span>{translate('Vertailuryhmän KA')} <b>{fmt(row.average)}</b></span><strong>{translate('Sija')} {row.rank} / {row.cohort}</strong></div>}
    <div className="discovery-sample"><span>{row.player.games} {translate('ottelua')} · {Math.round(row.player.minutes)} {translate('min')}</span>{view==='outliers'&&<span>{translate(row.teamChanged?'Joukkue vaihtunut':'Sama joukkue')}</span>}</div>
    {view==='outliers'&&<p className="discovery-baseline">{translate('Vertailukausi:')} {row.baseline.games} {translate('ottelua')} · {Math.round(row.baseline.minutes)} {translate('min')}</p>}
   </article>)}</div>:<p className="discovery-empty">{translate(view==='outliers'&&!previousId?'Edellistä kautta ei ole aineistossa. Pidä silmällä -näkymä näyttää tämän kauden vahvuuksia.':'Tähän nostoon ei vielä ole riittävää vertailuaineistoa.')}</p>}
  </div>
  <details className="discovery-method"><summary>{translate('Miksi nämä pelaajat?')}</summary>
   <p>{translate(view==='outliers'?'Saman pelaajan luvut edelliseen kauteen: syötöt ja levypallot 40 minuuttia kohti, heittotehokkuus sekä peliaika ottelua kohti. Peliajan muutos kuvaa roolia, ei itsessään parempaa tai heikompaa pelaajaa.':'Nostot eri osa-alueiden parhaasta 15 prosentista tässä vertailuryhmässä. Per 40 min -luvut suhteutetaan peliaikaan; heittotehokkuudessa huomioidaan kolmosten lisäarvo. Sama pelaaja näkyy vain kerran.')}</p>
   <p>{translate('Nykyinen otos: vähintään')} {selection.qualification.games} {translate('ottelua')} {translate('ja')} {selection.qualification.minutes} {translate('min.')} {translate(view==='outliers'?'Vertailukaudelta vähintään 8 ottelua ja 120 minuuttia. Heittotehokkuudessa vähintään 30 nykyistä ja 80 aiempaa pelitilanneheittoyritystä. Pelaajat yhdistetään tunnisteella tai yksiselitteisellä samalla nimellä.':'Lisäksi vähintään 6 syöttöä, 10 levypalloa, 3 riistoa tai 30 heittoyritystä noston osa-alueesta riippuen. Vertailuryhmän KA on minuuteilla tai heittoyrityksillä painotettu.')}</p>
   <p>{translate('Alkukauden pieni otos voi muuttua nopeasti. Nostot kuvaavat yksittäisiä tilastovahvuuksia, eivät kokonaisarvosanaa, ikää tai uran vaihetta.')}</p>
  </details>
 </section>;
}
