import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

// On-demand rendering: no idle animation loop and no external 3D assets.
export function createCabinet(host,awards,onUnavailable) {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.9;
  host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,0.1,40);
  camera.position.set(0,0.95,6.65);camera.lookAt(0,0.2,0);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,0.04);scene.environment=environment.texture;
  room.dispose();pmrem.dispose();
  const frame=new T.Group();scene.add(frame);frame.rotation.y=-0.055;
  const charcoal=new T.MeshStandardMaterial({color:'#101318',metalness:0.35,roughness:0.5,envMapIntensity:0.45});
  const back=new T.MeshStandardMaterial({color:'#07090c',roughness:0.96,envMapIntensity:0.15});
  const edge=new T.MeshStandardMaterial({color:'#40464a',metalness:0.75,roughness:0.36});
  const stone=new T.MeshStandardMaterial({color:'#202124',roughness:0.32,metalness:0.15});
  const grainCanvas=document.createElement('canvas');grainCanvas.width=256;grainCanvas.height=256;
  const ctx=grainCanvas.getContext('2d');ctx.fillStyle='#aaa';ctx.fillRect(0,0,256,256);
  for(let i=0;i<256;i++){ctx.fillStyle=`rgb(${140+(i*37%55)},${140+(i*37%55)},${140+(i*37%55)})`;ctx.fillRect(0,i,256,1);}
  const grain=new T.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(2,3);
  const gold=new T.MeshStandardMaterial({color:'#d7ad61',metalness:0.93,roughness:0.29,bumpMap:grain,bumpScale:0.004,side:T.DoubleSide});
  const silver=new T.MeshStandardMaterial({color:'#bfc8cd',metalness:0.94,roughness:0.32,bumpMap:grain,bumpScale:0.004});
  const led=new T.MeshBasicMaterial({color:'#c5ab7c'});
  function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(w,h,d,material,x,y,z){return mesh(new T.BoxGeometry(w,h,d),material,frame,x,y,z);}
  box(7.65,3.25,0.12,back,0,0,-0.43);
  box(0.15,3.4,0.95,charcoal,-3.9,0,0);box(0.15,3.4,0.95,charcoal,3.9,0,0);
  box(7.95,0.15,1,charcoal,0,1.7,0);box(7.95,0.18,1.05,charcoal,0,-1.65,0);
  box(7.68,0.08,1,stone,0,-1.35,0.06);
  box(7.68,0.035,0.025,edge,0,-1.37,0.58);
  box(7.4,0.018,0.028,led,0,1.57,0.34);
  // Recessed rear panel trims catch the light and make the cabinet depth readable.
  box(0.025,3.15,0.025,edge,-3.77,0,-0.33);box(0.025,3.15,0.025,edge,3.77,0,-0.33);
  const light=new T.DirectionalLight('#fff1d5',4);light.position.set(-3,6,5);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-5;light.shadow.camera.right=5;light.shadow.camera.top=5;light.shadow.camera.bottom=-5;light.shadow.normalBias=0.04;scene.add(light);
  const fill=new T.DirectionalLight('#9bbbcf',1.3);fill.position.set(4,2,3);scene.add(fill);
  scene.add(new T.HemisphereLight('#d5dce0','#14171c',1));
  const warm=new T.PointLight('#e8bc78',7,8,2);warm.position.set(0,1.3,0.45);frame.add(warm);
  const objects=[];
  awards.forEach((award,i)=>{
    const group=new T.Group();frame.add(group);objects.push(group);
    const spacing=Math.min(1.85,6.8/Math.max(awards.length,1));
    group.position.set((i-(awards.length-1)/2)*spacing,-1.3,0.06);
    const s=awards.length>4?0.86:1.1;group.scale.setScalar(s);
    mesh(new T.BoxGeometry(0.75,0.2,0.55),stone,group,0,0.1,0);
    mesh(new T.BoxGeometry(0.47,0.08,0.015),gold,group,0,0.105,0.286);
    const material=award.kind==='championship'?gold:silver;
    if(award.kind==='championship'){
      mesh(new T.CylinderGeometry(0.22,0.3,0.1,48),material,group,0,0.25,0);
      mesh(new T.CylinderGeometry(0.065,0.13,0.55,40),material,group,0,0.53,0);
      const points=[[0.085,0],[0.15,0.08],[0.22,0.19],[0.3,0.34],[0.37,0.54],[0.4,0.67],[0.37,0.67],[0.34,0.53],[0.27,0.34],[0.19,0.2],[0.12,0.1],[0.065,0.05]].map(([x,y])=>new T.Vector2(x,y));
      mesh(new T.LatheGeometry(points,64),material,group,0,0.8,0);
      const rim=mesh(new T.TorusGeometry(0.385,0.025,12,64),material,group,0,1.47,0);rim.rotation.x=Math.PI/2;
      [-1,1].forEach(side=>{const handle=mesh(new T.TorusGeometry(0.27,0.03,12,40,Math.PI*1.55),material,group,side*0.35,1.15,0);handle.scale.set(0.68,1,1);handle.rotation.z=side<0?Math.PI*0.23:-Math.PI*0.78;});
    }else{
      mesh(new T.CylinderGeometry(0.075,0.14,0.55,32),material,group,0,0.48,0);
      const disc=mesh(new T.CylinderGeometry(0.46,0.46,0.09,64),material,group,0,1.02,0);disc.rotation.x=Math.PI/2;
      const ring=mesh(new T.TorusGeometry(0.41,0.018,12,64),gold,group,0,1.02,0.062);
      const star=new T.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5+Math.PI/2,r=j%2?0.12:0.25;const x=Math.cos(a)*r,y=Math.sin(a)*r;j?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
      mesh(new T.ExtrudeGeometry(star,{depth:0.026,bevelEnabled:true,bevelThickness:0.012,bevelSize:0.01,bevelSegments:2}),gold,group,0,1.02,0.053);
    }
  });
  let raf=0,disposed=false,visible=true;
  const draw=()=>{raf=0;if(!disposed&&visible)renderer.render(scene,camera);};
  const request=()=>{if(!raf&&!disposed&&visible)raf=requestAnimationFrame(draw);};
  const resize=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.position.z=Math.max(6.65,8.5/(2*Math.tan(16*Math.PI/180)*camera.aspect));camera.updateProjectionMatrix();request();});resize.observe(host);
  const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();});visibility.observe(host);
  const contextLost=e=>{e.preventDefault();onUnavailable?.();};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  request();
  return {dispose(){disposed=true;cancelAnimationFrame(raf);resize.disconnect();visibility.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);scene.traverse(o=>{o.geometry?.dispose();});new Set([charcoal,back,edge,stone,gold,silver,led]).forEach(m=>m.dispose());grain.dispose();environment.dispose();renderer.dispose();renderer.domElement.remove();}};
}
