export const SITE_ORIGIN='https://korislab.vercel.app';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DEFAULT_SEASON='2026-27';
export const scopeKey=(path,season=DEFAULT_SEASON,league='women')=>`${path}?season=${season}${league==='men'?'&league=korisliiga':''}`;
// Public address of a page: the current season needs no season parameter, so the home page is plain / and
// current-season addresses stay the same while the season runs. Earlier seasons keep ?season=.
export const publicPath=(key,defaultSeason=DEFAULT_SEASON)=>key.replace(new RegExp(`\\?season=${defaultSeason}(&|$)`),(_,rest)=>rest?'?':'');
export function resolvePage(url,manifest){
 let path=url.pathname.replace(/\/+$/,'')||'/';path=path==='/'?'/':path+'/';
 path=path.replace(/^(\/matches\/\d+\/)(players|data|preview)\/$/,'$1');
 let decoded;try{decoded=decodeURIComponent(path);}catch{return {status:404};}
 const season=url.searchParams.get('season')||manifest.defaultSeason;
 const league=url.searchParams.has('league')?(url.searchParams.get('league')==='korisliiga'?'men':'women'):decoded.startsWith('/teams/korisliiga/')?'men':'women';
 // Invalid explicit scopes must not masquerade as another season's results.
 if(!manifest.seasons.includes(season)||url.searchParams.has('league')&&!['korisliiga','naisten-korisliiga'].includes(url.searchParams.get('league')))return {status:404};
 const key=scopeKey(decoded,season,league),page=manifest.pages[key];
 return page?{status:200,page,canonical:SITE_ORIGIN+publicPath(page.alias||key,manifest.defaultSeason)}:{status:404};
}
export function robotsText(production){return production?`User-agent: *\nAllow: /\nDisallow: /search/\nDisallow: /design-system/\nDisallow: /custom-import/\nDisallow: /data/\n\nUser-agent: OAI-SearchBot\nAllow: /\nDisallow: /search/\nDisallow: /design-system/\nDisallow: /custom-import/\nDisallow: /data/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n';}
export function sitemap(manifest){return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.entries(manifest.pages).filter(([,p])=>p.indexable).map(([key])=>`<url><loc>${escapeHtml(SITE_ORIGIN+publicPath(key,manifest.defaultSeason))}</loc></url>`).join('')}</urlset>`;}
export function renderPage(template,url,manifest){
 const result=resolvePage(url,manifest),production=url.origin===SITE_ORIGIN;
 const page=result.page||{title:'Sivua ei löytynyt',description:'Tätä KorisLab-sivua ei löytynyt. Palaa etusivulle tai valitse toinen näkymä.',summary:'<h1>404 — Tämä sivu ei osunut koriin.</h1><p>Linkki voi olla vanhentunut tai osoitteessa voi olla kirjoitusvirhe.</p><a href="/">Takaisin etusivulle</a>',indexable:false};
 const robots=production&&page.indexable?'index,follow,max-image-preview:large':'noindex,follow';
 const meta=`<title>${escapeHtml(page.title)} | KorisLab</title><meta name="description" content="${escapeHtml(page.description)}"><meta name="robots" content="${robots}"><meta property="og:type" content="website"><meta property="og:site_name" content="KorisLab"><meta property="og:locale" content="fi_FI"><meta property="og:title" content="${escapeHtml(page.title)} | KorisLab"><meta property="og:description" content="${escapeHtml(page.description)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(page.title)} | KorisLab"><meta name="twitter:description" content="${escapeHtml(page.description)}">${result.canonical?`<link rel="canonical" href="${escapeHtml(result.canonical)}"><meta property="og:url" content="${escapeHtml(result.canonical)}">`:''}${page.structured?`<script id="seo-structured" data-canonical="${escapeHtml(result.canonical)}" type="application/ld+json">${JSON.stringify(page.structured).replace(/</g,'\\u003c')}</script>`:''}`;
 const summary=`<main class="seo-summary"><a href="/" aria-label="KorisLab etusivu"><img src="/favicon.svg" width="24" height="24" alt=""> KorisLab</a>${page.summary}</main>`;
 const css='<style id="seo-summary-style">.seo-summary{max-width:900px;margin:8vh auto;padding:24px;color:#ddd;background:#111;font:16px/1.65 system-ui}.seo-summary h1{font-size:32px;line-height:1.2}.seo-summary a{color:#df945b}.seo-summary img{vertical-align:middle}.seo-summary ul{padding-left:20px}.seo-summary dl{display:grid;grid-template-columns:1fr 1fr;gap:12px}.seo-summary dd{margin:0}.seo-summary table{width:100%;border-collapse:collapse}.seo-summary td,.seo-summary th{text-align:left;border-bottom:1px solid #333;padding:8px}.seo-summary small{color:#aaa}</style>';
 // Keep factual no-JS/error content without introducing a second visible layout.
 const bootStyle='<style id="app-boot-style">html{background:#0b0b0b}html[data-app-loading] .seo-summary{display:none}</style>';
 const bootScript=`<script id="app-boot-script">document.documentElement.setAttribute('data-app-loading','');function revealFallback(){if(document.querySelector('.seo-summary'))document.documentElement.removeAttribute('data-app-loading')}window.addEventListener('error',function(event){if(event.target===window||event.target.tagName==='SCRIPT')revealFallback()},true);window.addEventListener('unhandledrejection',revealFallback)</script>`;
 const html=template.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s+name=["']robots["'][^>]*>/i,'').replace('</head>',meta+css+bootStyle+bootScript+'</head>').replace('<div id="root"></div>',`<div id="root">${summary}</div>`);
 return {status:result.status,html,robots};
}
