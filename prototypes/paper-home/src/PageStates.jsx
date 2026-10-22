import {Component,useEffect,useState} from 'react';
import {t} from './i18n';
import {useSeason} from './SeasonContext';
import {routeHref} from './routing';
import {BrandMark} from './BrandMark';
import './page-states.css';

export function LoadingSkeleton({variant='list',label='Ladataan tietoja…'}){
 return <div className={`loading-skeleton skeleton-${variant}`} aria-busy="true"><p className="sr-only" role="status">{t(label)}</p><div aria-hidden="true" className="skeleton-content">{variant==='profile'?<div className="skeleton-profile"><i className="skeleton-avatar"/><div><i className="skeleton-title"/><i className="skeleton-copy"/><i className="skeleton-copy short"/></div></div>:variant==='search'?<div className="skeleton-answer"><i className="skeleton-copy short"/><i className="skeleton-title"/><i className="skeleton-value"/><i className="skeleton-copy"/></div>:variant==='chart'?<div className="skeleton-chart"><i/><i/><i/></div>:<div className="skeleton-filters"><i/><i/><i/></div>}{variant!=='chart'&&<>{['profile','comparison'].includes(variant)&&<div className="skeleton-cards">{[0,1,2].map(i=><div key={i}><i className="skeleton-copy"/><i className="skeleton-value"/><i className="skeleton-copy short"/></div>)}</div>}<div className="skeleton-rows">{[0,1,2,3,4].map(i=><div key={i}><i/><i/><i/></div>)}</div></>}</div></div>;
}
export function StateCard({title,description,actionLabel='Yritä uudelleen',onAction,children,tone='empty'}){
 return <article className={`page-state state-${tone}`} role={tone==='error'?'alert':'status'}><span className="state-symbol" aria-hidden="true">{tone==='error'?'!':'—'}</span><div><h3>{t(title)}</h3>{description&&<p>{t(description)}</p>}<div className="state-actions">{onAction&&<button type="button" onClick={onAction}>{t(actionLabel)}</button>}{children}</div></div></article>;
}
export function NotFoundPage({onNavigate}){
 const {leagueId,seasonId}=useSeason();
 const link=(section,label)=> <a href={routeHref({section,leagueId,seasonId})} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onNavigate?.(section);}}>{t(label)}</a>;
 return <section className="not-found-page"><div className="not-found-code" aria-hidden="true">404</div><h1>{t('Tämä sivu ei osunut koriin.')}</h1><p>{t('Linkki voi olla vanhentunut tai osoitteessa voi olla kirjoitusvirhe. Löydät tutut näkymät sivuvalikosta.')}</p><div className="state-actions">{link('Etusivu','Takaisin etusivulle')}{link('Yleiskatsaus','Avaa yleiskatsaus')}</div><div className="not-found-explore"><span>{t('Etsitkö jotakin näistä?')}</span>{link('Ottelut','Ottelut')}{link('Pelaajat','Pelaajat')}{link('Joukkueet','Joukkueet')}</div></section>;
}
export function ConnectionNotice(){
 const [online,setOnline]=useState(()=>navigator.onLine);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 return online?null:<div className="connection-notice" role="status"><i aria-hidden="true"/><span>{t('Verkkoyhteys on poikki. Jo ladatut tiedot voivat silti näkyä.')}</span></div>;
}
function UnexpectedError(){return <main className="unexpected-error"><a href="/" className="error-brand" aria-label={t('KorisLab etusivu')}><BrandMark/></a><StateCard tone="error" title="Sivun avaaminen epäonnistui" description="Tapahtui odottamaton virhe. Kokeile ladata sivu uudelleen." actionLabel="Lataa sivu uudelleen" onAction={()=>window.location.reload()}><a href="/">{t('Takaisin etusivulle')}</a></StateCard></main>;}
export class AppErrorBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<UnexpectedError/>:this.props.children;}
}
