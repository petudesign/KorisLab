import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolvePage,renderPage,scopeKey,sitemap,publicPath} from '../server/seo.mjs';
const manifest=JSON.parse(readFileSync(new URL('../dist/client/_seo/manifest.json',import.meta.url)));
const template='<html><head><title>Old</title><meta name="robots" content="noindex,follow"></head><body><div id="root"></div></body></html>';
test('boot preserves no-JS facts without flashing a skeleton and recovers on bundle failure',()=>{
 const {html}=renderPage(template,new URL('https://korislab.vercel.app/'),manifest);
 assert.match(html,/class="seo-summary"/);
 assert.doesNotMatch(html,/app-boot-placeholder|Ladataan KorisLabia/);
 assert.match(html,/html\[data-app-loading\] \.seo-summary\{display:none\}/);
 const script=html.match(/<script id="app-boot-script">([\s\S]*?)<\/script>/)[1];
 const attrs=new Set(),listeners={};let pending=true;
 const window={addEventListener:(name,fn)=>listeners[name]=fn};
 const document={documentElement:{setAttribute:name=>attrs.add(name),removeAttribute:name=>attrs.delete(name)},querySelector:()=>pending?{}:null};
 runInNewContext(script,{window,document});
 assert.ok(attrs.has('data-app-loading'));
 listeners.error({target:{tagName:'IMG'}});assert.ok(attrs.has('data-app-loading'));
 listeners.error({target:{tagName:'SCRIPT'}});assert.ok(!attrs.has('data-app-loading'));
 attrs.add('data-app-loading');pending=false;
 listeners.unhandledrejection();assert.ok(attrs.has('data-app-loading'),'late errors must not alter the mounted application');
});
test('tracking queries never become canonical; leagues and seasons remain distinct',()=>{
 const a=resolvePage(new URL('https://korislab.vercel.app/players/?season=2025-26&utm_source=chatgpt.com'),manifest);
 const b=resolvePage(new URL('https://korislab.vercel.app/players/?season=2025-26&league=korisliiga'),manifest);
 assert.equal(a.canonical,'https://korislab.vercel.app/players/?season=2025-26');assert.notEqual(a.canonical,b.canonical);
});
test('HTML escapes source text and prevents script termination in structured data',()=>{
 const custom={...manifest,pages:{[scopeKey('/')]:{title:'A < B "title"',description:'Test </script>',summary:'<h1>Visible</h1>',indexable:true,structured:{'@context':'https://schema.org',name:'</script><script>alert(1)</script>'}}}};
 const result=renderPage(template,new URL('https://korislab.vercel.app/'),custom);
 assert.match(result.html,/A &lt; B &quot;title&quot;/);assert.doesNotMatch(result.html,/<script>alert/);assert.match(result.html,/\\u003c\/script>/);assert.equal((result.html.match(/name="robots"/g)||[]).length,1);
});
test('all generated summaries have source context, one factual heading and matching schema URL',()=>{
 assert.ok(Object.keys(manifest.pages).length>1900);
 for(const [key,p] of Object.entries(manifest.pages)){
  assert.match(p.summary,/Basket.fi/);assert.match(p.summary,/Aineisto ja laskenta/);assert.equal((p.summary.match(/<h1>/g)||[]).length,1);
  const page=p.structured['@graph'][0];assert.equal(page.url,'https://korislab.vercel.app'+publicPath(p.alias||key,manifest.defaultSeason));
 }
});
test('server-rendered player statistics match the real copied game totals and played appearances',()=>{
 const games=JSON.parse(readFileSync(new URL('../public/data/women-2025-26-matches.json',import.meta.url)));
 const id='903b6ff9-90bc-11f1-8aff-7bff69c6eb8e';let points=0,count=0;
 for(const game of games.filter(g=>g.verified))for(const team of game.teams)for(const p of team.players)if(p.id===id&&p.minutesValue>0){count++;points+=p.stats.points;}
 const page=manifest.pages[scopeKey('/players/'+id+'/','2025-26')];assert.ok(page);assert.match(page.summary,new RegExp('<dt>Ottelut</dt><dd>'+count+'</dd>'));
 const average=(points/count).toLocaleString('fi-FI',{minimumFractionDigits:1,maximumFractionDigits:1});assert.ok(page.summary.includes('<dt>PTS / ottelu</dt><dd>'+average+'</dd>'));
});
test('Vercel function preserves scope queries, returns HEAD correctly and refuses missing assets',async()=>{
 const {default:handler}=await import('../.vercel/output/functions/render.func/serve.mjs');
 const invoke=(url,method='GET',host='korislab.vercel.app')=>{const headers={};let body;const res={statusCode:200,setHeader:(key,value)=>headers[key]=value,end:value=>{body=value;}};handler({url,method,headers:{host}},res);return {status:res.statusCode,headers,body};};
 const page=invoke('/render?__path=/matches/968959/&season=2025-26');assert.equal(page.status,200);assert.match(page.body,/55–94/);
 assert.equal(invoke('/render?__path=/does-not-exist/').status,404);
 assert.equal(invoke('/render?__path=/matches/968959/&season=2025-26','HEAD').body,undefined);
 assert.equal(invoke('/render?__path=/api/missing').body,'Not found');
 assert.match(invoke('/render?__path=/overview/&season=2025-26','GET','preview.vercel.app').headers['X-Robots-Tag'],/noindex/);
});
test('current-season pages use season-free public addresses, so the home page is plain /',()=>{
 const pages={[scopeKey('/')]:{title:'Etusivu',description:'d',summary:'',indexable:true},[scopeKey('/players/','2025-26')]:{title:'P',description:'d',summary:'',indexable:true},[scopeKey('/','2026-27','men')]:{title:'M',description:'d',summary:'',indexable:true}};
 const custom={...manifest,pages};
 assert.equal(resolvePage(new URL('https://korislab.vercel.app/'),custom).canonical,'https://korislab.vercel.app/');
 assert.equal(resolvePage(new URL('https://korislab.vercel.app/?season=2026-27'),custom).canonical,'https://korislab.vercel.app/');
 assert.equal(resolvePage(new URL('https://korislab.vercel.app/?league=korisliiga'),custom).canonical,'https://korislab.vercel.app/?league=korisliiga');
 assert.equal(resolvePage(new URL('https://korislab.vercel.app/players/?season=2025-26'),custom).canonical,'https://korislab.vercel.app/players/?season=2025-26');
 const map=sitemap(custom);
 assert.match(map,/<loc>https:\/\/korislab\.vercel\.app\/<\/loc>/);
 assert.doesNotMatch(map,/season=2026-27/);
});

test('the About page says what KorisLab is, without JavaScript, and is indexed once',()=>{
 const pages=Object.entries(manifest.pages).filter(([key])=>key.startsWith('/tietoa/'));
 assert.equal(pages.filter(([,p])=>p.indexable).length,1);
 const home=manifest.pages[scopeKey('/tietoa/')];
 assert.match(home.summary,/Petteri Helttulan tekemä suomalaisen koripallon analytiikkasivusto/);
 assert.match(home.summary,/ei ole Koripalloliiton/);
});

test('the article has a breadcrumb trail through the list, and its team links resolve',()=>{
 const page=manifest.pages[scopeKey('/analyysit/viisi-ottelua/')],trail=page.structured['@graph'].find(n=>n['@type']==='BreadcrumbList').itemListElement;
 assert.deepEqual(trail.map(c=>c.name),['KorisLab','Analyysit','Mitä viisi ottelua kertoo?']);
 assert.deepEqual(trail.map(c=>c.position),[1,2,3]);
 assert.equal(trail[1].item,'https://korislab.vercel.app/analyysit/');
 assert.equal(trail[2].item,page.structured['@graph'][0].url);
 assert.match(page.summary,/<h2>Lyhyesti<\/h2>/);
 const links=[...page.summary.matchAll(/href="(\/teams\/[^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
 assert.equal(links.length,16);
 for(const link of links)assert.ok(Object.keys(manifest.pages).some(key=>publicPath(key,manifest.defaultSeason)===link),link);
});
