// Measured on the home page: without a GPU, one animated full-hero shader takes most of the main thread,
// and the Fog engine (730 kB gzip) is the largest single cost on a phone while its canvas is almost invisible there.
const SOFTWARE_RENDERER=/swiftshader|llvmpipe|softpipe|software|basic render/i;

export function isSoftwareRenderer(name){return SOFTWARE_RENDERER.test(name||'');}

let softwareRendering;
// No GPU means the page's own thread pays for every shader frame, so effects draw one still frame instead.
export function usesSoftwareRendering(){
 if(softwareRendering!==undefined)return softwareRendering;
 softwareRendering=false;
 try{
  const gl=document.createElement('canvas').getContext('webgl2')||document.createElement('canvas').getContext('webgl');
  const info=gl?.getExtension('WEBGL_debug_renderer_info');
  if(info)softwareRendering=isSoftwareRenderer(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
 }catch{}
 return softwareRendering;
}

// The hero Fog needs WebGPU. Phones (the same 700 px limit as the CSS) keep the static haze: the dashboard covers the canvas there.
export async function canShowHeroFog({wide,saveData,gpu}){
 if(!wide||saveData||!gpu)return false;
 try{return Boolean(await gpu.requestAdapter());}catch{return false;}
}

// Decoration starts only after the page has loaded, so it never competes with content for network or CPU.
export function afterPageSettled(run){
 let cancelled=false,idle=0,timer=0;
 const schedule=()=>{
  if(cancelled)return;
  if(window.requestIdleCallback)idle=window.requestIdleCallback(run,{timeout:2000});
  else timer=setTimeout(run,500);
 };
 if(document.readyState==='complete')schedule();
 else window.addEventListener('load',schedule,{once:true});
 return()=>{
  cancelled=true;
  window.removeEventListener('load',schedule);
  if(idle)window.cancelIdleCallback?.(idle);
  clearTimeout(timer);
 };
}
