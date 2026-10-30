// Draws the home page's basketball figures as dot matrices, in the same language as the "datan kautta" headline.
// The poses are defined here as capsules, not traced from any photo, so no real person is depicted.
// node scripts/build-dot-figures.mjs
import {writeFileSync} from 'node:fs';

const W=440,H=720,STEP=6,MAX_R=2.7;
const SKIN=.6,JERSEY=1,SHORTS=.34,SHOE=.9;
// Each part: tone, then a chain of [x,y,radius] joints. Later parts sit in front of earlier ones.
const figures={
 shooter:{ball:[262,58,34],parts:[
  [SKIN,[[168,412,28],[128,510,21],[150,612,13]]],            // tucked leg
  [SHOE,[[150,612,14],[120,642,10]]],
  [SKIN,[[216,412,30],[238,530,22],[232,640,13]]],            // reaching leg
  [SHOE,[[232,640,14],[268,668,10]]],
  [SHORTS,[[192,394,44],[160,482,30]]],
  [SHORTS,[[198,394,44],[224,492,32]]],
  [SKIN,[[172,240,19],[150,150,14],[228,84,10]]],             // guide arm
  [JERSEY,[[210,250,54],[196,360,38],[192,394,42]]],          // torso
  [SKIN,[[216,212,17],[220,190,16]]],                         // neck
  [SKIN,[[222,170,30]]],                                      // head
  [SKIN,[[250,240,19],[296,170,14],[272,92,10]]],             // shooting arm
 ]},
 layup:{ball:[126,64,34],parts:[
  [SKIN,[[222,412,30],[276,508,22],[300,600,13]]],            // trailing leg
  [SHOE,[[300,600,14],[336,624,10]]],
  [SKIN,[[262,416,30],[226,520,22],[250,632,13]]],            // jumping leg
  [SHOE,[[250,632,14],[220,662,10]]],
  [SHORTS,[[238,392,44],[270,484,31]]],
  [SHORTS,[[252,394,44],[232,492,32]]],
  [SKIN,[[276,252,19],[334,320,14],[372,250,10]]],            // off arm
  [JERSEY,[[234,256,54],[246,362,38],[246,392,42]]],          // torso
  [SKIN,[[230,216,17],[226,194,16]]],                         // neck
  [SKIN,[[222,172,30]]],                                      // head
  [SKIN,[[192,246,19],[152,170,14],[132,102,10]]],            // reaching arm
 ]},
};

// Signed distance to a capsule with different radii at its ends.
function capsule(px,py,[ax,ay,ar],[bx,by,br]){
 const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(px-ax-dx*t,py-ay-dy*t)-(ar+(br-ar)*t);
}
const partDistance=(x,y,joints)=>joints.length===1?Math.hypot(x-joints[0][0],y-joints[0][1])-joints[0][2]:Math.min(...joints.slice(1).map((joint,i)=>capsule(x,y,joints[i],joint)));

function draw({ball,parts}){
 const dots=[];
 for(let row=0;row*STEP<H;row++)for(let col=0;col*STEP<W;col++){
  const x=col*STEP+STEP/2+(row%2?STEP/2:0),y=row*STEP+STEP/2;
  const toBall=Math.hypot(x-ball[0],y-ball[1])-ball[2];
  if(toBall<0){
   // Seams, so it reads as a basketball even at this resolution.
   const seam=Math.abs(x-ball[0])<2.6||Math.abs(y-ball[1])<2.6||Math.abs(Math.hypot(x-ball[0]-ball[2]*1.15,y-ball[1])-ball[2]*.72)<2.6||Math.abs(Math.hypot(x-ball[0]+ball[2]*1.15,y-ball[1])-ball[2]*.72)<2.6;
   const light=.55+.45*Math.max(0,1-Math.hypot(x-ball[0]+11,y-ball[1]+11)/ball[2]);
   dots.push([x,y,seam?1:MAX_R*light,seam?'#7a4a24':'#ef9a4f']);
   continue;
  }
  let tone=null,edge=0;
  for(const [partTone,joints] of parts){
   const d=partDistance(x,y,joints);
   if(d<0){tone=partTone;edge=-d;}
  }
  if(tone==null)continue;
  // Rounded shading: smaller dots at the edge and on the side away from the light.
  const round=Math.min(1,edge/16),side=.82+.18*(1-x/W),radius=MAX_R*Math.sqrt(tone)*(.6+.4*round)*side;
  dots.push([x,y,radius,tone===JERSEY?'#e9b77c':tone===SHORTS?'#8f7458':tone===SHOE?'#f3e3cf':'#c79a6b']);
 }
 const byColor=new Map();
 for(const [x,y,r,color] of dots)(byColor.get(color)||byColor.set(color,[]).get(color)).push(`<circle cx="${+x.toFixed(1)}" cy="${+y.toFixed(1)}" r="${+r.toFixed(2)}"/>`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${[...byColor].map(([color,items])=>`<g fill="${color}">${items.join('')}</g>`).join('')}</svg>\n`;
}
for(const [name,figure] of Object.entries(figures))writeFileSync(new URL(`../public/assets/dot-${name}.svg`,import.meta.url),draw(figure));
