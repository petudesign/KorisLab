import {useEffect,useState} from 'react';
import {t as translate} from './i18n';

const PHONE='(max-width:700px)';
export function HeroPreview({href,onOpen,children}){
 const [phone,setPhone]=useState(()=>matchMedia(PHONE).matches);
 useEffect(()=>{const media=matchMedia(PHONE),update=()=>setPhone(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return <div className="dashboard-frame"><div className="hero-preview-content" inert={phone}>{children}</div><a className="hero-preview-open" href={href} aria-label={translate('Avaa yleiskatsaus')} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();onOpen();}}/></div>;
}
