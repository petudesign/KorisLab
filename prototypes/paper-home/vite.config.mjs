import {readFileSync,existsSync} from "node:fs";
import {renderPage} from "./server/seo.mjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(),{
 name:'korislab-http-seo',
 configureServer(server){server.middlewares.use(async(req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method)||!req.headers.accept?.includes('text/html'))return next();
  const url=new URL(req.url,'http://127.0.0.1:5174');
  if(/^\/(src|assets|data|fonts|@|node_modules)\//.test(url.pathname)||!existsSync('dist/client/_seo/manifest.json'))return next();
  try{const manifest=JSON.parse(readFileSync('dist/client/_seo/manifest.json','utf8'));const template=await server.transformIndexHtml(req.url,readFileSync('index.html','utf8'));const result=renderPage(template,url,manifest);res.statusCode=result.status;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('X-Robots-Tag',result.robots);res.end(req.method==='HEAD'?undefined:result.html);}catch(error){next(error);}
 });}
 }],
});
