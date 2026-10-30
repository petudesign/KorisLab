import {useId} from 'react';
import {useI18n} from './i18n';
import {useMetadata} from './seo';
import {DEFAULT_SEASON} from '../server/seo.mjs';
import {about} from './lib/aboutContent';
import './about-page.css';

// Reached from the footer only: it answers who and what, so it does not compete with the statistics in the navigation.
export default function AboutPage(){
 const {language}=useI18n(),lang=language==='fi'?'fi':'en',id=useId();
 useMetadata(about.title[lang],about.lead[lang],{section:'Tietoa',seasonId:DEFAULT_SEASON,leagueId:'women'});
 return <article className="about-page" aria-labelledby={id}><h1 id={id}>{about.title[lang]}</h1><p className="about-lead">{about.lead[lang]}</p>
  {about.sections.map(section=><section key={section.q.fi}><h2>{section.q[lang]}</h2><p>{section.a[lang]}</p>{section.links&&<p className="about-links">{section.links.map(link=><a key={link.href} href={link.href} target="_blank" rel="noreferrer">{typeof link.label==='string'?link.label:link.label[lang]}</a>)}</p>}</section>)}
 </article>;
}
