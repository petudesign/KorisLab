import {useEffect} from 'react';
import {t,useI18n} from './i18n';
import {SITE_ORIGIN,scopeKey,publicPath} from '../server/seo.mjs';
export function useMetadata(title,description,scope,enabled=true,missing=false){
 const {language}=useI18n();
 useEffect(()=>{
  if(!enabled)return;
  const translatedTitle=t(title),translatedDescription=t(description);
  document.title=`${translatedTitle} | KorisLab`;
  const set=(key,value,property=false)=>{const attr=property?'property':'name';let el=document.head.querySelector(`meta[${attr}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(attr,key);document.head.append(el);}el.content=value;};
  let path=location.pathname.replace(/\/+$/,'')||'/';path=path==='/'?'/':path+'/';path=scope.canonicalPath||path;path=path.replace(/^(\/matches\/\d+\/)(data|players|preview)\/$/,'$1');
  const internal=['/search/','/design-system/','/custom-import/','/data/','/analyysit/'].includes(path);
  const query=new URLSearchParams(location.search);
  const invalid=missing||scope.section==='Sivua ei löytynyt'||query.has('season')&&!['2024-25','2025-26','2026-27'].includes(query.get('season'))||query.has('league')&&!['korisliiga','naisten-korisliiga'].includes(query.get('league'));

  const robots=location.origin===SITE_ORIGIN&&!internal&&!invalid?'index,follow,max-image-preview:large':'noindex,follow';
  set('description',translatedDescription);set('robots',robots);set('og:type','website',true);set('og:site_name','KorisLab',true);set('og:locale',language==='en'?'en_GB':'fi_FI',true);set('og:title',translatedTitle+' | KorisLab',true);set('og:description',translatedDescription,true);set('twitter:card','summary');set('twitter:title',translatedTitle+' | KorisLab');set('twitter:description',translatedDescription);
  let canonical=document.head.querySelector('link[rel="canonical"]'),ld=document.querySelector('#seo-structured');
  if(invalid){canonical?.remove();ld?.remove();document.head.querySelector('meta[property="og:url"]')?.remove();return;}
  const url=SITE_ORIGIN+publicPath(scopeKey(path,scope.seasonId,scope.leagueId));
  if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=url;set('og:url',url,true);
  // Server fact markup is retained only for its matching initial page. Never leave another player's JSON-LD behind after SPA navigation.
  if(ld?.getAttribute('data-canonical')!==url){ld?.remove();ld=document.createElement('script');ld.id='seo-structured';ld.type='application/ld+json';ld.dataset.canonical=url;ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url,name:translatedTitle,description:translatedDescription,inLanguage:language});document.head.append(ld);}
 },[title,description,scope.seasonId,scope.leagueId,scope.section,scope.canonicalPath,enabled,language,missing]);
}
