// Three.js court for a simulated game log. Events come from the simulator;
// movement between events is illustrative and derived from players' own shot spots.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

const COURT_L=28,COURT_W=15,HOOP_FROM_END=1.575,RIM_H=3.05,HOOP_X=COURT_L/2-HOOP_FROM_END;
export const TEAM_COLORS={home:'#91b4c8',away:'#df945b'};
const other=side=>side==='home'?'away':'home';
const offenseOf=e=>['defensive_rebound','steal','foul'].includes(e.type)?other(e.team):e.team;
// Engine convention: the away team attacks the right basket in the first half.
const attacksRight=(side,period)=>(side==='away')===(period<=2);
const toWorld=(x,y)=>new THREE.Vector3(x/100*COURT_L-COURT_L/2,0,y/100*COURT_W-COURT_W/2);
// Floor spots ordered from perimeter to rim; deeper shooters take the outer spots.
const SLOTS=[[30,50],[23,17],[23,83],[5,8],[9,62]];

function courtTexture(){
 const s=80,c=document.createElement('canvas');c.width=COURT_L*s;c.height=COURT_W*s;
 const g=c.getContext('2d');
 const grad=g.createLinearGradient(0,0,c.width,0);grad.addColorStop(0,'#141416');grad.addColorStop(.5,'#1b1b1e');grad.addColorStop(1,'#141416');
 g.fillStyle=grad;g.fillRect(0,0,c.width,c.height);
 for(let i=0;i<c.height;i+=12){g.fillStyle=i%24?'#ffffff04':'#0000000d';g.fillRect(0,i,c.width,6);}
 const X=m=>m*s;
 g.strokeStyle='#d9d9de';g.lineWidth=.05*s;
 g.strokeRect(X(.025),X(.025),X(COURT_L-.05),X(COURT_W-.05));
 g.beginPath();g.moveTo(X(14),0);g.lineTo(X(14),c.height);g.stroke();
 g.beginPath();g.arc(X(14),X(7.5),1.8*s,0,Math.PI*2);g.stroke();
 for(const side of [0,1]){
  const dir=side?-1:1,base=side?COURT_L:0,hoop=base+dir*HOOP_FROM_END;
  g.fillStyle=side?'#df945b1c':'#91b4c81c';
  const left=Math.min(X(base),X(base+dir*5.8));
  g.fillRect(left,X(7.5-2.45),5.8*s,4.9*s);g.strokeRect(left,X(7.5-2.45),5.8*s,4.9*s);
  g.beginPath();g.arc(X(base+dir*5.8),X(7.5),1.8*s,-Math.PI/2,Math.PI/2,side===1);g.stroke();
  const a=Math.asin(6.6/6.75);
  g.beginPath();g.moveTo(X(base),X(7.5-6.6));g.lineTo(X(hoop),X(7.5-6.6));
  if(side)g.arc(X(hoop),X(7.5),6.75*s,-Math.PI+a,Math.PI-a,true);else g.arc(X(hoop),X(7.5),6.75*s,-a,a);
  g.lineTo(X(base),X(7.5+6.6));g.stroke();
  g.beginPath();g.arc(X(hoop),X(7.5),1.25*s,-Math.PI/2,Math.PI/2,side===1);g.stroke();
 }
 g.fillStyle='#ffffff0d';g.font=`600 ${1.1*s}px Array, Inter, sans-serif`;g.textAlign='center';g.textBaseline='middle';
 g.fillText('KORISLAB',X(14),X(7.5));
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
 return tex;
}

function labelTexture(text,color){
 const c=document.createElement('canvas');c.width=256;c.height=128;
 const g=c.getContext('2d');
 if(text){g.fillStyle='#0b0b0bd0';g.beginPath();g.roundRect(8,30,240,68,16);g.fill();
  g.fillStyle=color;g.font='600 44px Inter, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,128,66);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

export function createSimCourt(host,{onTick}={}){
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
 host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0b0b);scene.fog=new THREE.Fog(0x0b0b0b,30,70);
 const camera=new THREE.PerspectiveCamera(38,16/9,.1,200);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.maxPolarAngle=Math.PI/2.1;
 scene.add(new THREE.HemisphereLight(0xe8e8f0,0x101012,.9));
 const sun=new THREE.DirectionalLight(0xffffff,1.3);sun.position.set(-6,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-17,right:17,top:10,bottom:-10});scene.add(sun);
 const floorMap=courtTexture();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(COURT_L,COURT_W),new THREE.MeshStandardMaterial({map:floorMap,roughness:.55,metalness:.05}));
 floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const apron=new THREE.Mesh(new THREE.PlaneGeometry(COURT_L+8,COURT_W+7),new THREE.MeshStandardMaterial({color:0x111113,roughness:.9}));
 apron.rotation.x=-Math.PI/2;apron.position.y=-.01;apron.receiveShadow=true;scene.add(apron);
 for(const dir of [-1,1]){
  const metal=new THREE.MeshStandardMaterial({color:0x9a9aa0,metalness:.6,roughness:.35});
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,3.4),metal);pole.position.set(dir*(COURT_L/2+.6),1.7,0);pole.castShadow=true;scene.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(1.1,.08,.08),metal);arm.position.set(dir*(COURT_L/2+.05),3.35,0);scene.add(arm);
  const board=new THREE.Mesh(new THREE.BoxGeometry(.04,1.05,1.8),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.2}));
  board.position.set(dir*(COURT_L/2-1.2),3.4,0);scene.add(board);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.23,.02,8,32),new THREE.MeshStandardMaterial({color:0xdf945b,metalness:.4,roughness:.4}));
  rim.rotation.x=Math.PI/2;rim.position.set(dir*HOOP_X,RIM_H,0);scene.add(rim);
 }
 const figures=[];
 for(const side of ['home','away'])for(let i=0;i<5;i++){
  const group=new THREE.Group(),color=new THREE.Color(TEAM_COLORS[side]);
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.26,1.15,6,16),new THREE.MeshStandardMaterial({color,roughness:.45}));body.position.y=.9;body.castShadow=true;group.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshStandardMaterial({color:0xf3f3f4,roughness:.6}));head.position.y=1.86;head.castShadow=true;group.add(head);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.46,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;group.add(ring);
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture('',TEAM_COLORS[side]),depthTest:false}));tag.scale.set(1.3,.65,1);tag.position.y=2.45;group.add(tag);
  scene.add(group);
  figures.push({side,slot:i,group,tag,ring,pid:null,pos:new THREE.Vector3(side==='home'?-3:3,0,(i-2)*2)});
 }
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.13,24,16),new THREE.MeshStandardMaterial({color:0xc8632a,roughness:.55}));ball.castShadow=true;scene.add(ball);
 const ballPos=new THREE.Vector3();

 let players={},actions=[],lineups=[],duration=2400,t=0,playing=false,speed=4,camMode='broadcast',snap=true,lastK=null,frame=0,last=performance.now(),disposed=false;
 const depth=pid=>{const s=players[pid]?.spot;return s?Math.hypot((s[0]-5.6)*.28,(s[1]-50)*.15):4;};
 const formation=lineup=>{const spots={};[...lineup].sort((a,b)=>depth(b)-depth(a)).forEach((pid,i)=>{spots[pid]=SLOTS[i];});return spots;};
 const lineupAt=(side,time)=>{let current=[];for(const l of lineups){if(l.t>time)break;if(l.team===side)current=l.players;}return current;};
 const eventIndex=time=>{let lo=-1,hi=actions.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(actions[mid].t<=time)lo=mid;else hi=mid-1;}return lo;};

 function targets(time){
  const k=eventIndex(time),prev=actions[k],next=actions[k+1]??actions[k];
  if(!next)return null;
  const offense=offenseOf(next),defense=other(offense),right=attacksRight(offense,next.period);
  const hoop=new THREE.Vector3(right?HOOP_X:-HOOP_X,0,0);
  const spot=(x,y)=>right?toWorld(100-x,100-y):toWorld(x,y);
  const attackers=lineupAt(offense,time),defenders=lineupAt(defense,time),spots=formation(attackers),out={},lead=next.t-time;
  attackers.forEach((pid,i)=>{
   const [sx,sy]=spots[pid];
   let p=spot(sx,sy).add(new THREE.Vector3(Math.sin(time*.6+i*1.7)*.7,0,Math.cos(time*.5+i*2.3)*.6));
   if(pid===next.player&&(next.type==='2pt'||next.type==='3pt')&&next.x!=null)p=p.lerp(toWorld(next.x,next.y),Math.min(1,Math.max(0,1-(lead-.4)/3)));
   else if(pid===next.player&&next.type==='free_throw')p=hoop.clone().add(new THREE.Vector3(right?-4.6:4.6,0,0));
   out[pid]=p;
  });
  const order=[...attackers].sort((a,b)=>depth(b)-depth(a));
  [...defenders].sort((a,b)=>depth(b)-depth(a)).forEach((pid,i)=>{
   const mark=out[order[i]]??hoop.clone();
   out[pid]=next.type==='free_throw'?hoop.clone().add(new THREE.Vector3(right?-1.8-i*.5:1.8+i*.5,0,(i%2?1:-1)*1.9)):mark.clone().lerp(hoop,order[i]===next.player?.18:.32);
  });
  let ballTarget,ballHeight=1;
  const since=time-(prev?.t??0);
  if(prev&&['2pt','3pt','free_throw'].includes(prev.type)&&since<1.1){
   ballTarget=new THREE.Vector3(attacksRight(prev.team,prev.period)?HOOP_X:-HOOP_X,0,0);
   ballHeight=prev.made?RIM_H-since*2.4:RIM_H+.3-since;
  }else if((next.type==='2pt'||next.type==='3pt')&&lead<.9&&out[next.player]){
   const f=1-lead/.9;ballTarget=out[next.player].clone().lerp(hoop,f);ballHeight=2.2+(RIM_H-2.2)*f+Math.sin(f*Math.PI)*2.2;
  }else{
   const holder=next.assist&&lead>1.3?next.assist:(offense===next.team?next.player:null)??attackers[0];
   ballTarget=(out[holder]??out[attackers[0]]??hoop).clone().add(new THREE.Vector3(.3,0,.25));
   ballHeight=.25+Math.abs(Math.sin(time*7))*.75;
  }
  return {k,out,ballTarget,ballHeight,prev,next};
 }

 function update(dt){
  const state=targets(t);if(!state)return;
  const on={home:lineupAt('home',t),away:lineupAt('away',t)};
  for(const f of figures){
   const pid=on[f.side][f.slot];
   if(pid!==f.pid){f.pid=pid;f.tag.material.map?.dispose();const p=players[pid];f.tag.material.map=labelTexture(p?`${p.number??''} ${p.short}`.trim():'',TEAM_COLORS[f.side]);f.tag.material.needsUpdate=true;}
   f.group.visible=Boolean(pid);
   const target=state.out[pid];if(!target)continue;
   if(snap)f.pos.copy(target);
   else{const step=target.clone().sub(f.pos),max=7.5*dt;if(step.length()>max)step.setLength(max);f.pos.add(step.multiplyScalar(Math.min(1,dt*6)));}
   f.group.position.copy(f.pos);
   f.ring.material.opacity=pid===state.next?.player&&state.next.t-t<2?1:.45;
  }
  const bt=state.ballTarget.clone();bt.y=state.ballHeight;
  if(snap)ballPos.copy(bt);else ballPos.lerp(bt,Math.min(1,dt*10));
  ball.position.copy(ballPos);snap=false;
  const e=state.prev,clock=Math.max(0,(e?e.clock:600)-(t-(e?.t??0)));
  onTick?.({t,duration,playing,period:e?.period??1,clock,home:e?.home_score??0,away:e?.away_score??0,eventIndex:state.k,changed:state.k!==lastK});
  lastK=state.k;
 }

 function updateCamera(dt){
  if(camMode==='orbit'){controls.update();return;}
  const focus=new THREE.Vector3(ballPos.x*.5,0,.6);let want;
  if(camMode==='tactical'){want=new THREE.Vector3(0,31,.01);focus.set(0,0,0);}
  else if(camMode==='baseline'){const dir=Math.sign(ballPos.x)||1;want=new THREE.Vector3(dir*(COURT_L/2+6),5.5,ballPos.z*.3);focus.set(dir*4,1,0);}
  else{const far=camera.aspect<1.5?1.5:1;want=new THREE.Vector3(ballPos.x*.45,12.5*far,17.5*far);}
  camera.position.lerp(want,Math.min(1,dt*2.5));camera.lookAt(focus);
 }

 function loop(now){
  if(disposed)return;
  // The game clock follows real time; motion smoothing stays capped when frames are slow.
  const real=Math.min(1,(now-last)/1000),dt=Math.min(.1,real);last=now;
  if(actions.length){
   if(playing){t=Math.min(duration,t+real*speed);if(t>=duration)playing=false;}
   update(playing?dt*speed:dt);
  }
  updateCamera(dt);renderer.render(scene,camera);frame=requestAnimationFrame(loop);
 }
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight||w*9/16;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 const observer=new ResizeObserver(resize);observer.observe(host);
 camera.position.set(0,11,19);camera.lookAt(0,.8,0);resize();frame=requestAnimationFrame(loop);

 return {
  load(roster,log){
   players=roster;actions=log.filter(e=>e.type!=='lineup');lineups=log.filter(e=>e.type==='lineup');
   duration=(actions.at(-1)?.t??2400)+3;t=0;snap=true;lastK=null;
  },
  actions:()=>actions,
  setPlaying(value){if(value&&t>=duration){t=0;snap=true;}playing=value;},
  setSpeed(value){speed=value;},
  seek(value){t=value;snap=true;},
  setCamera(mode){camMode=mode;controls.enabled=mode==='orbit';},
  dispose(){
   disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
   scene.traverse(o=>{o.geometry?.dispose();const m=o.material;if(m){m.map?.dispose();m.dispose();}});
   floorMap.dispose();renderer.dispose();renderer.domElement.remove();
  },
 };
}
