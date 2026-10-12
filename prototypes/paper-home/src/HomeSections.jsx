import {t as translate,locale} from './i18n';
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import { useSeason } from './SeasonContext';
import './home-sections.css';
import {HomeFooter} from './HomeFooter';
import {useHomeMotion} from './useHomeMotion';
import './home-motion.css';
import {HomeComparison} from './HomeComparison';
const format=n=>n.toLocaleString(locale(),{maximumFractionDigits:1,minimumFractionDigits:1});
export function HomeSections({onOverview,onTeams,onPlayers}){
 const {data:season,leagueName,seasonLabel}=useSeason();
const teams=season.aggregate.teams;
const best=[...teams].sort((a,b)=>b.metrics.efg_pct-a.metrics.efg_pct)[0];
const closest=teams.filter(t=>t!==best).sort((a,b)=>Math.abs(a.per_game.points-best.per_game.points)-Math.abs(b.per_game.points-best.per_game.points))[0];
const leagueAverage={name:"Sarjan keskiarvo",metrics:season.aggregate.league.metrics};
 const {root,number}=useHomeMotion(best.metrics.efg_pct);
 return <div className="home-continuation" ref={root}>
 <section className="home-insight"><div><h2>{translate("Sama peli.")}<br/><em>{translate("Eri tehokkuus.")}</em></h2><p>{translate(best.name)}{translate(" erottuu sarjan tehokkaimpana heittojoukkueena. Pelkkä pistemäärä ei vielä kerro, miten laadukkaasti joukkue käyttää heittopaikkansa.")}</p><button className="home-text-link" onClick={onOverview}>{translate("Tutki kauden lukuja ")}<ArrowOutwardOutlined/></button></div><div className="insight-data"><span>{translate(best.name)}{translate(" · eFG")}</span><strong aria-label={translate(`${format(best.metrics.efg_pct)} prosenttia`)}><span aria-hidden="true">{translate(format(number))}<small>{translate("%")}</small></span></strong><div className="insight-comparison">{translate([best,leagueAverage].map(t=><div key={t.name}><span>{translate(t.name)}</span><div><i style={{width:`${t.metrics.efg_pct}%`}}/></div><b>{translate(format(t.metrics.efg_pct))}{translate("%")}</b></div>))}</div><p>{translate("eFG huomioi kolmen pisteen heittojen lisäarvon.")}<br/>{translate(leagueName)} {translate(seasonLabel)}{translate(" · ")}{translate(season.aggregate.games)}{translate(" ottelua")}</p></div></section>
 <section className="home-analysis"><header><h2>{translate("Mistä ero syntyy?")}</h2><p>{translate("Samankaltainen pistemäärä. Erilainen tapa pelata.")}</p></header><HomeComparison a={best} b={closest} onOverview={onOverview}/></section>
 <section className="home-explore"><header><h2>{translate("Löydä oma näkökulmasi.")}</h2><p>{translate("Katso joukkuetta kokonaisuutena tai aloita yksittäisestä pelaajasta.")}</p></header><div className="explore-options"><button onClick={onTeams}><GroupsOutlined/><div><h3>{translate("Joukkueet")}</h3><p>{translate("Heittotehokkuus, pelitapa ja joukkueiden väliset erot.")}</p></div><ArrowOutwardOutlined/></button><button onClick={onPlayers}><PersonOutlined/><div><h3>{translate("Pelaajat")}</h3><p>{translate("Roolit, vahvuudet ja vaikutus joukkueen peliin.")}</p></div><ArrowOutwardOutlined/></button></div></section>
 <HomeFooter onNavigate={onOverview}/>
 </div>;
}
