import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderPage,robotsText,sitemap,SITE_ORIGIN} from './seo.mjs';
let manifest,template;
export default function handler(req,res){
 // Build Output functions keep bundled files beside the entrypoint.
 const base=path.dirname(fileURLToPath(import.meta.url));
 manifest??=JSON.parse(readFileSync(path.join(base,'manifest.json'),'utf8'));template??=readFileSync(path.join(base,'template.html'),'utf8');
 const origin=`https://${req.headers.host}`,url=new URL(req.url,origin);
 const route=url.searchParams.get('__path');if(route){url.pathname=route;url.searchParams.delete('__path');}
 if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 if(/^\/(api|assets|data|fonts|_seo)\//.test(url.pathname)){res.statusCode=404;res.setHeader('Content-Type','text/plain; charset=utf-8');return res.end(req.method==='HEAD'?undefined:'Not found');}
 let result;
 if(url.pathname==='/robots.txt')result={status:200,body:robotsText(url.origin===SITE_ORIGIN),type:'text/plain; charset=utf-8'};
 else if(url.pathname==='/sitemap.xml')result={status:200,body:url.origin===SITE_ORIGIN?sitemap(manifest):'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',type:'application/xml; charset=utf-8'};
 else{const page=renderPage(template,url,manifest);result={status:page.status,body:page.html,type:'text/html; charset=utf-8'};res.setHeader('X-Robots-Tag',page.robots);}
 res.statusCode=result.status;res.setHeader('Content-Type',result.type);res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.end(req.method==='HEAD'?undefined:result.body);
}
