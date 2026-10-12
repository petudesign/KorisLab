import {renderPage,robotsText,sitemap,SITE_ORIGIN} from '../server/seo.mjs';
const manifests=new WeakMap();
async function loadManifest(binding,readAsset){
 if(!manifests.has(binding)){const pending=readAsset('/_seo/manifest.json').then(async r=>{if(!r.ok)throw Error('SEO manifest unavailable');return r.json();}).catch(error=>{manifests.delete(binding);throw error;});manifests.set(binding,pending);}
 return manifests.get(binding);
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),readAsset=path=>{const target=new URL(request.url);target.pathname=path;target.search='';return env.ASSETS.fetch(new Request(target,{method:'GET'}));};
  if(!['GET','HEAD'].includes(request.method))return env.ASSETS.fetch(request);
  if(url.pathname==='/robots.txt')return new Response(request.method==='HEAD'?null:robotsText(url.origin===SITE_ORIGIN),{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  if(url.pathname.startsWith('/_seo/'))return new Response(null,{status:404});
  const response=await env.ASSETS.fetch(request);
  if(url.pathname!=='/sitemap.xml'&&(!request.headers.get('accept')?.includes('text/html')||/^\/(api|assets|data|src|fonts)\//.test(url.pathname)))return response;
  if(response.status!==404&&!response.headers.get('content-type')?.includes('text/html')&&url.pathname!=='/sitemap.xml')return response;
  let manifest;try{manifest=await loadManifest(env.ASSETS,readAsset);}catch{return new Response('SEO manifest unavailable',{status:503,headers:{'X-Robots-Tag':'noindex'}});}
  if(url.pathname==='/sitemap.xml')return new Response(request.method==='HEAD'?null:(url.origin===SITE_ORIGIN?sitemap(manifest):'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>'),{headers:{'Content-Type':'application/xml; charset=utf-8'}});
  const template=await readAsset('/index.html');if(!template.ok)return template;
  const page=renderPage(await template.text(),url,manifest);
  return new Response(request.method==='HEAD'?null:page.html,{status:page.status,headers:{'Content-Type':'text/html; charset=utf-8','X-Robots-Tag':page.robots,'Cache-Control':'public, max-age=0, must-revalidate'}});
 }
};
