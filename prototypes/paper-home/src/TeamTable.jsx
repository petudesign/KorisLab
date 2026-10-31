import {t as translate,locale} from './i18n';
import { useMemo, useState } from 'react';
import { getSeason, useSeason } from './SeasonContext';
import {useMatches} from './useMatches';
import {leagueOrder} from './lib/standings';
import {TeamLogo} from './TeamLogo';
import {routeHref,slug} from './routing';
import './team-table.css';
import './table-sort.css';
const format=n=>n.toLocaleString(locale(),{maximumFractionDigits:1,minimumFractionDigits:1});
const signed=n=>`${n>0?'+':''}${n.toLocaleString(locale())}`;
const standingsColumns=[
 {key:'games',label:'O',title:'Ottelut',value:t=>t.standing.games},
 {key:'wins',label:'V',title:'Voitot',value:t=>t.standing.wins},
 {key:'losses',label:'H',title:'Tappiot',value:t=>t.standing.losses},
 {key:'winPct',label:'V %',title:'Voittoprosentti',value:t=>100*t.standing.wins/t.standing.games,format:n=>format(n)+'%'},
 {key:'difference',label:'+ / −',title:'Tehdyt pisteet miinus päästetyt pisteet',value:t=>t.standing.pointsFor-t.standing.pointsAgainst,format:signed},
];
const efficiencyColumns=[
 {key:'offensive_rating',label:'ORtg',title:'Pisteet / 100 pallonhallintaa',value:t=>t.metrics.offensive_rating,format},
 {key:'defensive_rating',label:'DRtg',title:'Päästetyt pisteet / 100 pallonhallintaa',value:t=>t.metrics.defensive_rating,format},
 {key:'net_rating',label:'NET',title:'Hyökkäystehokkuus miinus puolustustehokkuus',value:t=>t.metrics.net_rating,format:n=>(n>0?'+':'')+format(n)},
 {key:'efg_pct',label:'eFG %',title:'Heittotehokkuus, kolmosten lisäarvo huomioitu',value:t=>t.metrics.efg_pct,format},
 {key:'offensive_rebound_pct',label:'ORB %',title:'Osuus hyökkäyspään levypalloista',value:t=>t.metrics.offensive_rebound_pct,format},
];
export function TeamTable({selectedTeam,onEntityNavigate}){
 const {data,leagueName,seasonLabel,leagueId,seasonId}=useSeason();
 const [tab,setTab]=useState('standings'),[sort,setSort]=useState({key:'rank',direction:'asc'});
 const columns=tab==='standings'?standingsColumns:efficiencyColumns;
 const teams=data.aggregate.teams.map(team=>({...team,standing:data.standings[team.source_team_id]})).filter(team=>team.standing?.games>0);
 const {games}=useMatches(getSeason(leagueId,seasonId).matchesUrl);
 const ranked=useMemo(()=>{
  const place=new Map(leagueOrder(games||[]).map((name,index)=>[name,index]));
  const known=team=>place.get(team.name)??Infinity,difference=team=>team.standing.pointsFor-team.standing.pointsAgainst;
  // Until the games arrive the head-to-head comparisons cannot run, so level teams wait in point-difference order.
  return [...teams].sort((a,b)=>(b.standing.wins-a.standing.wins)||(known(a)-known(b))||(difference(b)-difference(a)));
 },[teams,games]);
 const column=columns.find(c=>c.key===sort.key);
 const rows=column?[...ranked].sort((a,b)=>(column.value(a)-column.value(b))*(sort.direction==='asc'?1:-1)):sort.direction==='asc'?ranked:[...ranked].reverse();
 const changeTab=value=>{setTab(value);setSort(value==='standings'?{key:'rank',direction:'asc'}:{key:'net_rating',direction:'desc'});};
 const changeSort=key=>setSort(previous=>key==='rank'?{key,direction:previous.key===key&&previous.direction==='asc'?'desc':'asc'}:{key,direction:previous.key===key&&previous.direction==='desc'?'asc':'desc'});
 return <article className="dash-card dash-team-table"><header><div><h3>{translate("Joukkueet")}</h3><p>{translate(leagueName)} {translate(seasonLabel)}</p></div><div className="team-table-tabs" role="group" aria-label={translate("Joukkuetaulukon näkymä")}><button aria-pressed={tab==='standings'} onClick={()=>changeTab('standings')}>{translate("Sarjataulukko")}</button><button aria-pressed={tab==='efficiency'} onClick={()=>changeTab('efficiency')}>{translate("Tehokkuus")}</button></div></header><div className="team-table-scroll"><table><thead><tr><th scope="col" aria-sort={sort.key==='rank'?(sort.direction==='asc'?'ascending':'descending'):'none'}><button title={translate('Sarjasijoitus')} onClick={()=>changeSort('rank')} aria-label={translate('Järjestä: Sarjasijoitus')}>{translate("#")}</button></th><th scope="col">{translate("Joukkue")}</th>{translate(columns.map(c=><th key={c.key} scope="col" aria-sort={sort.key===c.key?(sort.direction==='asc'?'ascending':'descending'):'none'}><button title={translate(c.title)} onClick={()=>changeSort(c.key)} aria-label={translate(`Järjestä: ${c.title}`)}>{translate(c.label)}{translate(sort.key===c.key&&<span aria-hidden="true">{translate(sort.direction==='desc'?' ↓':' ↑')}</span>)}</button></th>))}</tr></thead><tbody>{translate(rows.map(team=>{const teamSlug=slug(team.name);return <tr key={team.source_team_id} className={selectedTeam===team.source_team_id?'selected-team':''}><td className="team-table-rank">{translate(ranked.indexOf(team)+1)}</td><th scope="row"><a href={routeHref({section:'Joukkueet',leagueId,seasonId,teamId:teamSlug})} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Joukkueet',teamSlug);}}}><TeamLogo name={team.name} className="team-table-logo" decorative/>{translate(team.name)}</a></th>{translate(columns.map(c=><td key={c.key} className={['difference','net_rating'].includes(c.key)&&c.value(team)>0?'positive':''}>{translate(c.format?c.format(c.value(team)):c.value(team))}</td>))}</tr>;}))}</tbody></table></div><p className="team-table-note">{translate(tab==='standings'?'Järjestys: sarjapisteet ja tasatilanteessa kilpailusääntöjen vertailut, ensin keskinäiset ottelut. Tämä ei silti ole virallinen sarjataulukko: ottelut ilman tilastoja, kuten luovutukset, puuttuvat, ja jatkosarjakaudet näkyvät yhtenä taulukkona.':'ORtg ja DRtg: pisteet / 100 pallonhallintaa. Pienempi DRtg on parempi.')}{translate(" Tilastoidut ottelut · ")}{translate("Valitse joukkueen nimi avataksesi profiilin.")}</p></article>;
}
