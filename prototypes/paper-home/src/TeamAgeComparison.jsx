import {useMemo,useState} from 'react';
import {locale,useI18n} from './i18n';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import {AGE_MIN_SHARE,teamAgeRows} from './lib/gameBests';
import './team-resources.css';

const number=value=>value.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
// The league's ages side by side, built like the resource comparison beside it.
export function TeamAgeComparison({teams,leagueId,seasonId}){
 const {language}=useI18n(),say=(fi,en)=>language==='fi'?fi:en;
 const [metric,setMetric]=useState('average_age');
 const rows=useMemo(()=>teamAgeRows(teams,metric),[teams,metric]),max=Math.max(...rows.map(row=>row.age));
 const options=[['average_age',say('Minuuteilla painotettu','Weighted by minutes')],['roster_average_age',say('Kaikki pelanneet','Everyone who played')]];
 return <article className="dash-card team-intel-card team-resource-comparison">
  <header className="team-resource-heading"><h4 className="team-intel-title">{say('Joukkueiden keski-ikä','Team average age')}</h4><div className="team-resource-tabs" aria-label={say('Keski-iän laskutapa','How the average is counted')}>{options.map(([key,label])=><button key={key} type="button" aria-pressed={metric===key} onClick={()=>setMetric(key)}>{label}</button>)}</div></header>
  <p className="team-resource-period">{seasonId.replace('-','–')} · {say('Nuorin ensin','Youngest first')}</p>
  <ol className="team-resource-list" aria-label={say('Joukkueet nuorimmasta vanhimpaan','Teams from youngest to oldest')}>{rows.map(row=><li key={row.name}>
   <span className="team-resource-rank">{row.rank}</span>
   <div className="team-resource-team"><a href={routeHref({section:'Joukkueet',teamId:slug(row.name),leagueId,seasonId})}><span className="team-intel-logo" aria-hidden="true"><TeamLogo name={row.name}/></span><span>{row.name}</span></a><small>{row.players_known} / {row.players} {say('pelaajaa','players')}</small></div>
   <div className="team-resource-value"><strong>{number(row.age)}</strong><span className="team-resource-bar" aria-hidden="true"><i style={{width:`${100*row.age/max}%`}}/></span></div>
  </li>)}</ol>
  <p className="team-intel-note">{say(`Ikä on kauden aloitusvuosi miinus Basket.fi:hin kirjattu syntymävuosi, joten se on likimääräinen. Painotettu luku antaa eniten pelaaville suurimman painon. Mukana ovat joukkueet, joiden minuuteista ikä tiedetään vähintään ${AGE_MIN_SHARE*100} %:lle. Luku kuvaa joukkueen ikää, ei sen tulevaa kehitystä.`,`Age is the season’s starting year minus the birth year recorded at Basket.fi, so it is approximate. The weighted number counts those who play most the most. Teams are included when age is known for at least ${AGE_MIN_SHARE*100} % of their minutes. It describes the team’s age, not how it will develop.`)}</p>
 </article>;
}
