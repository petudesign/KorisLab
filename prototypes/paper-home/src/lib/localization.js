export function createTranslator(catalog){
 const translations=Object.fromEntries(Object.entries(catalog).map(([key,value])=>[key.trim(),value.trim()]));
 const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const phrases=Object.keys(translations).filter(key=>key.length>1).sort((a,b)=>b.length-a.length);
 const pattern=new RegExp(`(?<![\\p{L}])(?:${phrases.map(escape).join('|')})(?![\\p{L}])`,'gu');
 const translate=(value,language)=>{
  if(language!=='en')return value;
  if(Array.isArray(value))return value.map(item=>translate(item,language));
  if(typeof value!=='string')return value;
  const trimmed=value.trim();
  if(Object.hasOwn(translations,trimmed))return value.replace(trimmed,translations[trimmed]);
  return value.replace(pattern,match=>translations[match]);
 };
 return translate;
}

// First visit: Finnish if the browser lists Finnish anywhere, since many Finns run an English browser; otherwise English.
// Search engines keep the Finnish page, so one address is not indexed in a language it does not serve by default.
const CRAWLERS=/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|google-extended|googleother/i;
export function preferredLanguage(languages=[],agent=''){
 if(CRAWLERS.test(agent)||!languages.length)return 'fi';
 return languages.some(language=>/^fi\b/i.test(language))?'fi':'en';
}
