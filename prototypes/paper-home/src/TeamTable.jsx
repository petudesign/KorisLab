import {t as translate,locale} from './i18n';
import { useState } from 'react';
import { useSeason } from './SeasonContext';
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
 const [tab,setTab]=useState('standings'),[sort,setSort]=useState({key:'winPct',direction:'desc'});
 const columns=tab==='standings'?standingsColumns:efficiencyColumns;
 const teams=data.aggregate.teams.map(team=>({...team,standing:data.standings[team.source_team_id]})).filter(team=>team.standing?.games>0);
 const ranked=[...teams].sort((a,b)=>(b.standing.wins/b.standing.games-a.standing.wins/a.standing.games)||(b.standing.pointsFor-b.standing.pointsAgainst)-(a.standing.pointsFor-a.standing.pointsAgainst));
 const column=columns.find(c=>c.key===sort.key)||columns[0];
 const rows=[...ranked].sort((a,b)=>(column.value(a)-column.value(b))*(sort.direction==='asc'?1:-1));
 const changeTab=value=>{setTab(value);setSort(value==='standings'?{key:'winPct',direction:'desc'}:{key:'net_rating',direction:'desc'});};
 const changeSort=key=>setSort(previous=>({key,direction:previous.key===key&&previous.direction==='desc'?'asc':'desc'}));
 return <article className="dash-card dash-team-table"><header><div><h3>{translate("Joukkueet")}</h3><p>{translate(leagueName)} {translate(seasonLabel)}</p></div><div className="team-table-tabs" role="group" aria-label={translate("Joukkuetaulukon näkymä")}><button aria-pressed={tab==='standings'} onClick={()=>changeTab('standings')}>{translate("Sarjataulukko")}</button><button aria-pressed={tab==='efficiency'} onClick={()=>changeTab('efficiency')}>{translate("Tehokkuus")}</button></div></header><div className="team-table-scroll"><table><thead><tr><th scope="col">{translate("#")}</th><th scope="col">{translate("Joukkue")}</th>{translate(columns.map(c=><th key={c.key} scope="col" aria-sort={sort.key===c.key?(sort.direction==='asc'?'ascending':'descending'):'none'}><button title={translate(c.title)} onClick={()=>changeSort(c.key)} aria-label={translate(`Järjestä: ${c.title}`)}>{translate(c.label)}{translate(sort.key===c.key&&<span aria-hidden="true">{translate(sort.direction==='desc'?' ↓':' ↑')}</span>)}</button></th>))}</tr></thead><tbody>{translate(rows.map(team=>{const teamSlug=slug(team.name);return <tr key={team.source_team_id} className={selectedTeam===team.source_team_id?'selected-team':''}><td className="team-table-rank">{translate(ranked.indexOf(team)+1)}</td><th scope="row"><a href={routeHref({section:'Joukkueet',leagueId,seasonId,teamId:teamSlug})} onClick={event=>{if(onEntityNavigate&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onEntityNavigate('Joukkueet',teamSlug);}}}><TeamLogo name={team.name} className="team-table-logo" decorative/>{translate(team.name)}</a></th>{translate(columns.map(c=><td key={c.key} className={['difference','net_rating'].includes(c.key)&&c.value(team)>0?'positive':''}>{translate(c.format?c.format(c.value(team)):c.value(team))}</td>))}</tr>;}))}</tbody></table></div><p className="team-table-note">{translate(tab==='standings'?'Järjestys: voittoprosentti, tasatilanteessa piste-ero. Virallisia tasapistesääntöjä ei sovelleta, joten tämä ei ole virallinen sarjataulukko.':'ORtg ja DRtg: pisteet / 100 pallonhallintaa. Pienempi DRtg on parempi.')}{translate(" Tilastoidut ottelut · ")}{translate("Valitse joukkueen nimi avataksesi profiilin.")}</p></article>;
}
