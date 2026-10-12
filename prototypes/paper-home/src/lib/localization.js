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
