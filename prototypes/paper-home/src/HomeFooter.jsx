import {t as translate} from './i18n';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined';
import {BrandMark} from './BrandMark';
import {useSeason} from './SeasonContext';
import {routeHref} from './routing';
import './footer.css';
export function HomeFooter({onNavigate}){
 const {leagueId,seasonId,leagueName,seasonLabel,data}=useSeason();
 const link=section=><a key={section} href={routeHref({section,leagueId,seasonId})} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();onNavigate(section);}}>{translate(section)}</a>;
 return <footer className="site-footer" role="contentinfo">
  <div className="footer-main">
   <div className="footer-identity"><a className="footer-brand" href={routeHref({section:'Etusivu',leagueId,seasonId})} aria-label={translate("KorisLab etusivu")}><BrandMark/></a><p>{translate("Suomalainen koripallo,")}<br/>{translate("datan kautta.")}</p></div>
   <nav aria-label={translate("Footerin näkymät")}><h3>{translate("Tutki")}</h3>{translate(['Yleiskatsaus','Ottelut','Joukkueet','Pelaajat','Kausitrendit','Analyysit'].map(link))}</nav>
   <div className="footer-data"><h3>{translate("Aineisto")}</h3><p>{translate(leagueName)}<br/>{translate(seasonLabel)}{translate(" · ")}{translate(data.aggregate.games)}{translate(" tilastoitua ottelua")}</p><a href="https://tulospalvelu.basket.fi/" target="_blank" rel="noreferrer">{translate("Basket.fi-tulospalvelu ")}<ArrowOutwardOutlined aria-hidden="true"/></a><p className="footer-data-note">{translate("Tilastot perustuvat tallennettuun kausiaineistoon.")}</p></div>
  </div>
  <div className="footer-bottom"><span>{translate("© ")}{translate(new Date().getFullYear())}{translate(" KorisLab")}</span><button onClick={()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>{translate("Takaisin ylös ")}<ArrowUpwardOutlined aria-hidden="true"/></button></div>
 </footer>;
}
