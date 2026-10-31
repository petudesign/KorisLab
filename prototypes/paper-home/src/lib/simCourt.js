// Three.js court for a simulated game log. Events come from the simulator;
// movement between events is illustrative and derived from players' own shot spots.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

const COURT_L=28,COURT_W=15,HOOP_FROM_END=1.575,RIM_H=3.05,HOOP_X=COURT_L/2-HOOP_FROM_END;
export const TEAM_COLORS={home:'#91b4c8',away:'#df945b'};
const SHORTS={home:'#5d7686',away:'#9c6438'};
const SKIN='#d8cfc6',SHOE='#1b1b1d';
const RUN_SPEED=9;  // Metres per game second; fast enough that the ball never waits for its holder.
const other=side=>side==='home'?'away':'home';
const offenseOf=e=>['defensive_rebound','steal','foul'].includes(e.type)?other(e.team):e.team;
// Engine convention: the away team attacks the right basket in the first half.
const attacksRight=(side,period)=>(side==='away')===(period<=2);
const hoopFor=(side,period)=>new THREE.Vector3(attacksRight(side,period)?HOOP_X:-HOOP_X,0,0);
const toWorld=(x,y)=>new THREE.Vector3(x/100*COURT_L-COURT_L/2,0,y/100*COURT_W-COURT_W/2);
const isShot=e=>e&&(e.type==='2pt'||e.type==='3pt');
const isRebound=e=>e&&(e.type==='offensive_rebound'||e.type==='defensive_rebound');
// Floor spots ordered from perimeter to rim; deeper shooters take the outer spots.
const SLOTS=[[30,50],[23,17],[23,83],[5,8],[9,62]];

function canvasTexture(width,height,draw){
 const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'));
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function courtTexture(){
 const s=80;
 const tex=canvasTexture(COURT_L*s,COURT_W*s,g=>{
  const w=COURT_L*s,h=COURT_W*s,X=m=>m*s;
  const grad=g.createLinearGradient(0,0,w,0);grad.addColorStop(0,'#141416');grad.addColorStop(.5,'#1b1b1e');grad.addColorStop(1,'#141416');
  g.fillStyle=grad;g.fillRect(0,0,w,h);
  for(let i=0;i<h;i+=12){g.fillStyle=i%24?'#ffffff04':'#0000000d';g.fillRect(0,i,w,6);}
  g.strokeStyle='#d9d9de';g.lineWidth=.05*s;
  g.strokeRect(X(.025),X(.025),X(COURT_L-.05),X(COURT_W-.05));
  g.beginPath();g.moveTo(X(14),0);g.lineTo(X(14),h);g.stroke();
  g.beginPath();g.arc(X(14),X(7.5),1.8*s,0,Math.PI*2);g.stroke();
  for(const side of [0,1]){
   const dir=side?-1:1,base=side?COURT_L:0,hoop=base+dir*HOOP_FROM_END,left=Math.min(X(base),X(base+dir*5.8));
   g.fillStyle=side?'#df945b1c':'#91b4c81c';
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
 });
 tex.anisotropy=8;return tex;
}

const labelTexture=(text,color)=>canvasTexture(256,96,g=>{
 if(!text)return;
 g.font='600 40px Inter, sans-serif';
 const width=Math.min(248,g.measureText(text).width+36);
 g.fillStyle='#0b0b0bd9';g.beginPath();g.roundRect(128-width/2,18,width,60,14);g.fill();
 g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(text,128,50);
});

const numberTexture=(number,color)=>canvasTexture(128,128,g=>{
 g.fillStyle=color;g.fillRect(0,0,128,128);
 if(number){g.fillStyle='#0b0b0b';g.font='700 70px Inter, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(number,64,68);}
});

function makeHoop(scene,dir){
 const metal=new THREE.MeshStandardMaterial({color:0x8d8d93,metalness:.6,roughness:.35});
 const pad=new THREE.MeshStandardMaterial({color:0x232327,roughness:.8});
 const base=new THREE.Mesh(new THREE.BoxGeometry(1.1,1,1.3),pad);base.position.set(dir*(COURT_L/2+1.7),.5,0);base.castShadow=true;scene.add(base);
 const pole=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,.18),metal);pole.position.set(dir*(COURT_L/2+1.5),2.6,0);pole.castShadow=true;scene.add(pole);
  const boardX=dir*(COURT_L/2-1.2);
 // The arm runs from the pole all the way to the backboard.
 const armEnd=Math.abs(boardX)-.02,armStart=COURT_L/2+1.5;
 const arm=new THREE.Mesh(new THREE.BoxGeometry(armStart-armEnd,.14,.14),metal);arm.position.set(dir*(armStart+armEnd)/2,3.75,0);scene.add(arm);
 const board=new THREE.Mesh(new THREE.BoxGeometry(.04,1.05,1.8),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.28,roughness:.1}));
 board.position.set(boardX,3.425,0);scene.add(board);
 const line=new THREE.LineBasicMaterial({color:0xf3f3f4});
 const rect=(w,h,y)=>{const g=new THREE.BufferGeometry().setFromPoints([[-w,-h],[w,-h],[w,h],[-w,h],[-w,-h]].map(([z,yy])=>new THREE.Vector3(boardX-dir*.025,y+yy,z)));scene.add(new THREE.Line(g,line));};
 rect(.9,.525,3.425);rect(.295,.225,3.275);
 const hoopX=dir*HOOP_X;
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.225,.018,8,40),new THREE.MeshStandardMaterial({color:0xdf6b2b,metalness:.4,roughness:.4}));
 rim.rotation.x=Math.PI/2;rim.position.set(hoopX,RIM_H,0);scene.add(rim);
 const bracket=new THREE.Mesh(new THREE.BoxGeometry(.15,.03,.08),rim.material);bracket.position.set(hoopX+dir*.3,RIM_H,0);scene.add(bracket);
 const net=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.225,0),new THREE.Vector2(.19,-.2),new THREE.Vector2(.15,-.42)],14,0,Math.PI*2),
  new THREE.MeshBasicMaterial({color:0xf3f3f4,wireframe:true,transparent:true,opacity:.55}));
 net.position.set(hoopX,RIM_H,0);scene.add(net);
}

function makeFigure(scene,side){
 const jersey=new THREE.MeshStandardMaterial({color:TEAM_COLORS[side],roughness:.6});
 const shorts=new THREE.MeshStandardMaterial({color:SHORTS[side],roughness:.65});
 const skin=new THREE.MeshStandardMaterial({color:SKIN,roughness:.7});
 const shoe=new THREE.MeshStandardMaterial({color:SHOE,roughness:.5});
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const add=(parent,mesh,x,y,z)=>{mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 const legs=[-1,1].map(s=>{
  const hip=new THREE.Group();hip.position.set(s*.11,.95,0);body.add(hip);
  add(hip,new THREE.Mesh(new THREE.CapsuleGeometry(.075,.62,4,10),skin),0,-.42,0);
  add(hip,new THREE.Mesh(new THREE.BoxGeometry(.12,.09,.27),shoe),0,-.9,.05);
  return hip;
 });
 add(body,new THREE.Mesh(new THREE.CylinderGeometry(.2,.22,.32,16),shorts),0,.86,0);
 const torso=add(body,new THREE.Mesh(new THREE.CapsuleGeometry(.2,.36,4,16),jersey),0,1.32,0);torso.scale.set(1,1,.72);
 const numberMaterial=new THREE.MeshBasicMaterial({map:numberTexture('',TEAM_COLORS[side])});
 for(const z of [.15,-.15]){const plate=new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),numberMaterial);plate.position.set(0,1.36,z);if(z<0)plate.rotation.y=Math.PI;body.add(plate);}
 const arms=[-1,1].map(s=>{
  const shoulder=new THREE.Group();shoulder.position.set(s*.27,1.52,0);body.add(shoulder);
  add(shoulder,new THREE.Mesh(new THREE.CapsuleGeometry(.055,.5,4,10),skin),0,-.3,0);
  add(shoulder,new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),skin),0,-.6,0);
  return shoulder;
 });
 add(body,new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.1,10),skin),0,1.66,0);
 add(body,new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),skin),0,1.8,0);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.36,.43,32),new THREE.MeshBasicMaterial({color:TEAM_COLORS[side],transparent:true,opacity:.45,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.012;root.add(ring);
 const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture('',TEAM_COLORS[side]),depthTest:false}));tag.scale.set(1.25,.47,1);tag.position.y=2.35;root.add(tag);
 // Flat counter for the tactical view: team colour, jersey number, a rim that lights up for the acting player.
 const token=new THREE.Group();token.visible=false;token.position.y=.06;root.add(token);
 const tokenMaterial=new THREE.MeshBasicMaterial({map:numberTexture('',TEAM_COLORS[side])});
 const disc=new THREE.Mesh(new THREE.CircleGeometry(.48,40),tokenMaterial);disc.rotation.x=-Math.PI/2;token.add(disc);
 const rim=new THREE.Mesh(new THREE.RingGeometry(.48,.58,40),new THREE.MeshBasicMaterial({color:0x0b0b0b,transparent:true}));rim.rotation.x=-Math.PI/2;rim.position.y=.005;token.add(rim);
 scene.add(root);
 return {root,body,legs,arms,ring,tag,numberMaterial,token,tokenMaterial,tokenRim:rim,phase:Math.random()*6,yaw:0};
}

function ballTexture(){
 return canvasTexture(256,128,g=>{
  g.fillStyle='#c8632a';g.fillRect(0,0,256,128);
  g.strokeStyle='#2b1a10';g.lineWidth=4;
  g.beginPath();g.moveTo(0,64);g.lineTo(256,64);g.moveTo(64,0);g.lineTo(64,128);g.moveTo(192,0);g.lineTo(192,128);g.stroke();
  g.beginPath();g.ellipse(128,64,40,64,0,0,Math.PI*2);g.stroke();
 });
}

export function createSimCourt(host,{onTick}={}){
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
 host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0b0b);scene.fog=new THREE.Fog(0x0b0b0b,30,70);const fog=scene.fog;
 const camera=new THREE.PerspectiveCamera(38,16/9,.1,200);
 // The tactical view is a flat, true top-down projection so counters keep their size across the court.
 const topCamera=new THREE.OrthographicCamera(-16,16,9,-9,.1,100);topCamera.position.set(0,40,0);topCamera.up.set(0,0,-1);topCamera.lookAt(0,0,0);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;
 renderer.domElement.style.touchAction='';// OrbitControls sets 'none', which would stop the page scrolling past the court on touch.
 controls.maxPolarAngle=Math.PI/2.1;
 scene.add(new THREE.HemisphereLight(0xe8e8f0,0x101012,.9));
 const sun=new THREE.DirectionalLight(0xffffff,1.3);sun.position.set(-6,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-17,right:17,top:10,bottom:-10});scene.add(sun);
 const floorMap=courtTexture();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(COURT_L,COURT_W),new THREE.MeshStandardMaterial({map:floorMap,roughness:.55,metalness:.05}));
 floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
 const apron=new THREE.Mesh(new THREE.PlaneGeometry(COURT_L+10,COURT_W+8),new THREE.MeshStandardMaterial({color:0x111113,roughness:.9}));
 apron.rotation.x=-Math.PI/2;apron.position.y=-.01;apron.receiveShadow=true;scene.add(apron);
 makeHoop(scene,-1);makeHoop(scene,1);
 const figures=[];
 for(const side of ['home','away'])for(let i=0;i<5;i++)figures.push({side,slot:i,pid:null,pos:new THREE.Vector3(side==='home'?-3:3,0,(i-2)*2),...makeFigure(scene,side)});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.12,24,16),new THREE.MeshStandardMaterial({map:ballTexture(),roughness:.6}));
 ball.castShadow=true;scene.add(ball);
 const ballToken=new THREE.Mesh(new THREE.CircleGeometry(.26,32),new THREE.MeshBasicMaterial({color:0xe07a35}));
 ballToken.rotation.x=-Math.PI/2;ballToken.visible=false;scene.add(ballToken);
 const ballPos=new THREE.Vector3(),camFocus=new THREE.Vector3();

 let players={},actions=[],lineups=[],duration=2400,t=0,playing=false,speed=4,camMode='broadcast',snap=true,lastK=null,frame=0,last=performance.now(),disposed=false;
 const depth=pid=>{const s=players[pid]?.spot;return s?Math.hypot((s[0]-5.6)*.28,(s[1]-50)*.15):4;};
 const formation=lineup=>{const spots={};[...lineup].sort((a,b)=>depth(b)-depth(a)).forEach((pid,i)=>{spots[pid]=SLOTS[i];});return spots;};
 const lineupAt=(side,time)=>{let current=[];for(const l of lineups){if(l.t>time)break;if(l.team===side)current=l.players;}return current;};
 const eventIndex=time=>{let lo=-1,hi=actions.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(actions[mid].t<=time)lo=mid;else hi=mid-1;}return lo;};

 // Where everybody should be at `time`, and how the ball moves relative to them.
 function targets(time){
  const k=eventIndex(time),prev=actions[k],next=actions[k+1]??actions[k];
  if(!next)return null;
  const offense=offenseOf(next),defense=other(offense),hoop=hoopFor(offense,next.period),right=hoop.x>0;
  const spot=(x,y)=>right?toWorld(100-x,100-y):toWorld(x,y);
  const attackers=lineupAt(offense,time),defenders=lineupAt(defense,time),spots=formation(attackers),out={},lead=next.t-time,since=time-(prev?.t??0);
  attackers.forEach((pid,i)=>{
   const [sx,sy]=spots[pid];
   let p=spot(sx,sy).add(new THREE.Vector3(Math.sin(time*.6+i*1.7)*.7,0,Math.cos(time*.5+i*2.3)*.6));
   if(pid===next.player&&isShot(next)&&next.x!=null)p=p.lerp(toWorld(next.x,next.y),Math.min(1,Math.max(0,1-(lead-.4)/3)));
   else if(pid===next.player&&next.type==='free_throw')p=hoop.clone().add(new THREE.Vector3(right?-4.6:4.6,0,0));
   out[pid]=p;
  });
  const order=[...attackers].sort((a,b)=>depth(b)-depth(a));
  [...defenders].sort((a,b)=>depth(b)-depth(a)).forEach((pid,i)=>{
   const mark=out[order[i]]??hoop.clone();
   out[pid]=next.type==='free_throw'?hoop.clone().add(new THREE.Vector3(right?-1.8-i*.5:1.8+i*.5,0,(i%2?1:-1)*1.9)):mark.clone().lerp(hoop,order[i]===next.player?.18:.32);
  });
  // A rebounder crashes towards the rim as the ball comes off it.
  if(isRebound(next)&&out[next.player]&&lead<1.5){const rim=hoopFor(offenseOf(prev??next),next.period);out[next.player]=out[next.player].clone().lerp(rim,.6);}
  let ball,holder=null;
  if(prev&&(isShot(prev)||prev.type==='free_throw')&&since<1.1){
   ball={mode:'rim',rim:hoopFor(prev.team,prev.period),since,made:prev.made};
  }else if(isShot(next)&&lead<.9){
   ball={mode:'shot',shooter:next.player,hoop,progress:1-lead/.9};
  }else if(isRebound(next)&&prev&&(isShot(prev)||prev.type==='free_throw')){
   ball={mode:'loose',from:hoopFor(prev.team,prev.period),to:next.player,progress:Math.min(1,(since-1.1)/Math.max(.3,next.t-prev.t-1.1))};
  }else{
   const keeper=(isRebound(prev)||prev?.type==='steal')&&since<1.4?prev.player:null;
   holder=keeper??(next.assist&&lead>1.3?next.assist:offense===next.team&&next.player?next.player:attackers[0]);
   ball={mode:'hold',holder};
  }
  // Facing comes from the play, never from the ball's own position, so nobody chases their own dribble.
  const face={},marks={};
  attackers.forEach(pid=>{face[pid]=pid===holder||pid===next.player||!out[holder]?hoop:out[holder];});
  [...defenders].sort((a,b)=>depth(b)-depth(a)).forEach((pid,i)=>{marks[pid]=order[i];face[pid]=out[order[i]]??hoop;});
  if(next.type==='free_throw')for(const pid of [...attackers,...defenders])face[pid]=hoop;
  return {k,out,face,marks,ball,holder,prev,next,shooter:isShot(next)&&lead<.7?next.player:null};
 }

 function update(gameDt,realDt){
  const state=targets(t);if(!state)return;
  const on={home:lineupAt('home',t),away:lineupAt('away',t)},byPid={},tactical=camMode==='tactical';
  // Positions first, so stances can use where the opponent actually is this frame.
  for(const f of figures){const pid=on[f.side][f.slot];if(pid&&state.out[pid])byPid[pid]=f;}
  for(const f of figures){
   const pid=on[f.side][f.slot];
   if(pid!==f.pid){
    f.pid=pid;const p=players[pid];
    f.tag.material.map?.dispose();f.tag.material.map=labelTexture(p?`${p.number??''} ${p.short}`.trim():'',TEAM_COLORS[f.side]);f.tag.material.needsUpdate=true;
    f.numberMaterial.map?.dispose();f.numberMaterial.map=numberTexture(p?.number??'',TEAM_COLORS[f.side]);f.numberMaterial.needsUpdate=true;
    f.tokenMaterial.map?.dispose();f.tokenMaterial.map=numberTexture(p?.number??'',TEAM_COLORS[f.side]);f.tokenMaterial.needsUpdate=true;
   }
   f.root.visible=Boolean(pid);
   f.body.visible=f.ring.visible=!tactical;f.token.visible=tactical;
   f.tag.position.set(0,tactical?.3:2.35,tactical?.95:0);f.tag.scale.set(tactical?1:1.25,tactical?.38:.47,1);
   const target=state.out[pid];if(!target)continue;
   const before=f.pos.clone();
   if(snap)f.pos.copy(target);
   else{const step=target.clone().sub(f.pos),max=RUN_SPEED*gameDt;if(step.length()>max)step.setLength(max);f.pos.add(step);}
   f.root.position.copy(f.pos);
   const moved=snap?0:f.pos.distanceTo(before),pace=gameDt>0?moved/gameDt:0;
   // Running players face where they run; others face their role's target, turning at a human rate.
   const look=pace>1.5?f.pos.clone().sub(before):(state.face[pid]??f.pos).clone().sub(f.pos);
   if(look.lengthSq()>.01){
    let d=Math.atan2(look.x,look.z)-f.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));
    const turn=Math.min(Math.abs(d),realDt*7);f.yaw+=Math.sign(d)*turn;
   }
   f.body.rotation.y=f.yaw;
   f.phase+=moved*3.2;
   const stride=Math.min(1,pace/3)*.75,swing=Math.sin(f.phase)*stride,idle=Math.sin(t*1.6+f.phase)*.06;
   f.legs[0].rotation.x=swing;f.legs[1].rotation.x=-swing;
   const [left,right]=f.arms,shooting=pid===state.shooter,dribbling=pid===state.holder&&state.ball.mode==='hold';
   const markGap=state.marks[pid]&&byPid[state.marks[pid]]?f.pos.distanceTo(byPid[state.marks[pid]].pos):9;
   if(shooting){left.rotation.set(-2.75,0,-.15);right.rotation.set(-2.75,0,.15);}
   else if(dribbling){left.rotation.set(-.35+idle,0,-.35);right.rotation.set(-.45-Math.abs(Math.sin(t*7))*.4,0,.12);}
   else if(markGap<2.6&&pace<2){left.rotation.set(-.25+idle,0,-.95);right.rotation.set(-.25-idle,0,.95);}  // Defensive stance: arms wide.
   else{left.rotation.set(-swing*1.1-.12+idle,0,-.08);right.rotation.set(swing*1.1-.12-idle,0,.08);}
   const acting=pid===state.next?.player&&state.next.t-t<2;
   f.ring.material.opacity=acting?1:.4;
   f.tokenRim.material.color.set(acting||pid===state.holder?0xf3f3f4:0x0b0b0b);
  }
  // The ball is placed relative to where its holder actually is on screen.
  const hand=f=>f.pos.clone().add(new THREE.Vector3(Math.sin(f.yaw+.6)*.35,0,Math.cos(f.yaw+.6)*.35));
  const b=state.ball,bt=new THREE.Vector3();
  if(b.mode==='rim'){bt.copy(b.rim);bt.y=b.made?RIM_H-b.since*2.4:RIM_H+.3-b.since*.8;}
  else if(b.mode==='shot'&&byPid[b.shooter]){const from=hand(byPid[b.shooter]);bt.copy(from.lerp(b.hoop,b.progress));bt.y=2.3+(RIM_H-2.3)*b.progress+Math.sin(b.progress*Math.PI)*2;}
  else if(b.mode==='loose'&&byPid[b.to]){const to=hand(byPid[b.to]);bt.copy(b.from.clone().lerp(to,b.progress));bt.y=RIM_H*(1-b.progress)+1.2*b.progress+Math.sin(b.progress*Math.PI)*.8;}
  else{const f=byPid[b.holder];if(f){bt.copy(hand(f));bt.y=.2+Math.abs(Math.sin(t*7))*.75;}else bt.copy(ballPos);}
  if(snap)ballPos.copy(bt);else ballPos.lerp(bt,Math.min(1,realDt*14));
  ball.position.copy(ballPos);ball.rotation.x+=realDt*6;
  ball.visible=!tactical;ballToken.visible=tactical;ballToken.position.set(ballPos.x,.12,ballPos.z);
  snap=false;
  const e=state.prev,clock=Math.max(0,(e?e.clock:600)-(t-(e?.t??0)));
  onTick?.({t,duration,playing,period:e?.period??1,clock,home:e?.home_score??0,away:e?.away_score??0,eventIndex:state.k,changed:state.k!==lastK});
  lastK=state.k;
 }

 function updateCamera(dt){
  if(camMode==='orbit'){controls.update();return;}
  // The camera follows a heavily smoothed point on the court axis, not the bouncing ball.
  camFocus.x+=(Math.max(-10,Math.min(10,ballPos.x*.85))-camFocus.x)*Math.min(1,dt*1.2);
  let want,look;
  if(camMode==='tactical')return;
  if(camMode==='baseline'){const dir=Math.sign(camFocus.x)||1;want=new THREE.Vector3(dir*(COURT_L/2+5),6.5,4.5);look=new THREE.Vector3(dir*3,1,-.5);}
  else{const far=camera.aspect<1.5?1.5:1;want=new THREE.Vector3(camFocus.x*.85,12.5*far,17.5*far);look=new THREE.Vector3(camFocus.x,0,.6);}
  camera.position.lerp(want,Math.min(1,dt*1.5));camera.lookAt(look);
 }

 function loop(now){
  if(disposed)return;
  // The game clock follows real time; motion smoothing stays capped when frames are slow.
  const real=Math.min(1,(now-last)/1000),dt=Math.min(.1,real);last=now;
  if(actions.length){
   if(playing){t=Math.min(duration,t+real*speed);if(t>=duration)playing=false;}
   update(playing?dt*speed:0,dt);
  }
  updateCamera(dt);
  const top=camMode==='tactical';scene.fog=top?null:fog;  // Fog would wash out the flat counters from 40 m up.
  renderer.render(scene,top?topCamera:camera);frame=requestAnimationFrame(loop);
 }
 const resize=()=>{
  const w=host.clientWidth,h=host.clientHeight||w*9/16,aspect=w/h;
  renderer.setSize(w,h,false);camera.aspect=aspect;camera.updateProjectionMatrix();
  // Fit the whole court plus a margin in the top view, whatever the aspect ratio.
  let halfW=COURT_L/2+1.6,halfH=halfW/aspect;if(halfH<COURT_W/2+1.2){halfH=COURT_W/2+1.2;halfW=halfH*aspect;}
  // Extra room at the top keeps the scoreboard overlay off the court.
  Object.assign(topCamera,{left:-halfW,right:halfW,top:halfH+1.8,bottom:-halfH-.4});topCamera.updateProjectionMatrix();
 };
 const observer=new ResizeObserver(resize);observer.observe(host);
 camera.position.set(0,12.5,17.5);camera.lookAt(0,0,.6);resize();frame=requestAnimationFrame(loop);

 return {
  load(roster,log){
   players=roster;actions=log.filter(e=>e.type!=='lineup');lineups=log.filter(e=>e.type==='lineup');
   duration=(actions.at(-1)?.t??2400)+3;t=0;snap=true;lastK=null;
  },
  actions:()=>actions,
  setPlaying(value){if(value&&t>=duration){t=0;snap=true;}playing=value;},
  setSpeed(value){speed=value;},
  seek(value){t=value;snap=true;},
  setCamera(mode){camMode=mode;controls.enabled=mode==='orbit';renderer.domElement.style.touchAction=mode==='orbit'?'pan-y':'';},
  dispose(){
   disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();
   scene.traverse(o=>{o.geometry?.dispose();const m=o.material;if(m){m.map?.dispose();m.dispose();}});
   floorMap.dispose();renderer.dispose();renderer.domElement.remove();
  },
 };
}
