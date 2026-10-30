import {createContext,useContext,useMemo,useState} from 'react';
import translations from './translations.en.json';
import {createTranslator,preferredLanguage} from './lib/localization';

// A language the reader picked always wins. Without a window (build, tests) the source language stays.
export function initialLanguage(){
 if(typeof window==='undefined')return 'fi';
 let saved=null;
 try{saved=localStorage.getItem('korislab-language');}catch{}
 if(saved==='en'||saved==='fi')return saved;
 return preferredLanguage(navigator.languages?.length?navigator.languages:[navigator.language].filter(Boolean),navigator.userAgent);
}
let currentLanguage=initialLanguage();
// Keep the context identity when a translation edit triggers Vite hot reload.
const LanguageContext=import.meta.hot?.data.languageContext||createContext(null);
if(import.meta.hot)import.meta.hot.dispose(data=>{data.languageContext=LanguageContext;});
const translate=createTranslator(translations);
// Localize presentation only; routing, identifiers and source data stay unchanged.
export const t=value=>translate(value,currentLanguage);
export const locale=()=>currentLanguage==='en'?'en-GB':'fi-FI';
const englishSuffix=n=>{const mod100=n%100;if(mod100>=11&&mod100<=13)return 'th';return {1:'st',2:'nd',3:'rd'}[n%10]||'th';};
export const ordinal=n=>currentLanguage==='en'?`${n}${englishSuffix(n)}`:`${n}.`;

export function LanguageProvider({children}){
 const [language,setState]=useState(currentLanguage);
 const setLanguage=next=>{
  if(!['fi','en'].includes(next))return;
  currentLanguage=next;
  document.documentElement.lang=next;
  try{localStorage.setItem('korislab-language',next);}catch{}
  setState(next);
 };
 document.documentElement.lang=language;
 const value=useMemo(()=>({language,setLanguage}),[language]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useI18n=()=>useContext(LanguageContext);

export function LanguageSettings(){
 const {language,setLanguage}=useI18n();
 return <div className="language-settings"><label htmlFor="interface-language">{t('Käyttöliittymän kieli')}</label><select id="interface-language" value={language} onChange={e=>setLanguage(e.target.value)}><option value="fi">Suomi</option><option value="en">English</option></select><p>{t('Kielivalinta tallentuu tähän selaimeen.')}</p></div>;
}
