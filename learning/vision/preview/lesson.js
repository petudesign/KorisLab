let frames=[],selected=0,selectedPerson=null,lastVersion='';
const byId=id=>document.getElementById(id);
const names={green:'Vihreä peliasu',white:'Valkoinen peliasu',unknown:'Epäselvä'};
const shortNames={green:'Vihreä',white:'Valkoinen',unknown:'Epäselvä'};
const colors={green:'#46f59b',white:'#e5edff',unknown:'#eab178'};
function visiblePeople(){const cutoff=Number(byId('threshold').value)/100;return frames[selected].people.filter(p=>p.confidence>=cutoff && (byId('unknown').checked || p.shirt?.group!=='unknown'));}
function draw(){
  if(!frames.length)return;
  const f=frames[selected],img=byId('image'),canvas=byId('canvas');
  if(!img.complete||!img.naturalWidth)return;
  canvas.width=f.width;canvas.height=f.height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  const people=visiblePeople(),counts={green:0,white:0,unknown:0};
  for(const p of people)counts[p.shirt?.group||'unknown']++;
  if(byId('overlay').checked){
    ctx.font='bold 22px system-ui';
    for(const p of people){
      const shirt=p.shirt,group=shirt?.group||'unknown';
      const[x1,y1,x2,y2]=p.box;
      ctx.strokeStyle=colors[group];ctx.lineWidth=3;ctx.strokeRect(x1,y1,x2-x1,y2-y1);
      const text=`#${shirt?.number||'?'} ${shortNames[group]} · ${Math.round(p.confidence*100)} %`,y=Math.max(26,y1);
      ctx.fillStyle='#102019';ctx.fillRect(x1,y-26,ctx.measureText(text).width+14,28);
      ctx.fillStyle=colors[group];ctx.fillText(text,x1+7,y-5);
      if(shirt?.number===selectedPerson){const[a,b,c,d]=shirt.crop_box;ctx.strokeStyle='#ff9d47';ctx.lineWidth=5;ctx.strokeRect(a,b,c-a,d-b);}
    }
  }
  byId('summary').textContent=`Ruutu ${f.seconds} s · ${people.length} ihmishavaintoa · vihreä ${counts.green}, valkoinen ${counts.white}, epäselvä ${counts.unknown}`;
  byId('crops').replaceChildren();
  for(const p of people){
    const s=p.shirt;if(!s)continue;
    const button=document.createElement('button');button.className='crop';button.style.borderColor=colors[s.group];
    button.setAttribute('aria-pressed',String(s.number===selectedPerson));
    const image=document.createElement('img');image.src=s.image;image.alt=`Havainnon ${s.number} vartalon rajaus`;
    const label=document.createElement('strong');label.textContent=`#${s.number} · ${names[s.group]}`;
    const confidence=document.createElement('small');confidence.textContent=`Ihmishavainto ${Math.round(p.confidence*100)} %`;
    const shares=document.createElement('span');shares.textContent=`Vihreitä pikseleitä ${Math.round(s.green_share*100)} % · valkoisia ${Math.round(s.white_share*100)} %`;
    button.append(image,label,confidence,shares);button.onclick=()=>{selectedPerson=s.number;draw();byId("frame").scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});};byId('crops').append(button);
  }
}
function select(i){
  selected=i;selectedPerson=null;const f=frames[i];byId('empty').hidden=true;byId('image').hidden=false;
  byId('image').onload=draw;byId('image').src=f.image;
  document.querySelectorAll('#buttons button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));draw();
}
byId('threshold').oninput=()=>{byId('thresholdValue').textContent=byId('threshold').value+' %';draw();};
byId('overlay').onchange=draw;byId('unknown').onchange=draw;
async function poll(){
  try{
    const data=await(await fetch('/status')).json();byId('status').textContent=data.message;
    const version=JSON.stringify(data);
    if(version!==lastVersion){
      lastVersion=version;byId('events').replaceChildren();
      for(const e of data.events||[]){const line=document.createElement('div');line.textContent=e.time+' · '+e.message;byId('events').append(line);}
      frames=data.frames;byId('buttons').replaceChildren();
      frames.forEach((f,i)=>{const b=document.createElement('button');b.textContent=f.seconds+' s';b.onclick=()=>select(i);byId('buttons').append(b);});
      if(frames.length)select(Math.min(selected,frames.length-1));
    }
  }catch{byId('status').textContent='Yhteys paikalliseen palvelimeen katkesi.';}
  setTimeout(poll,1500);
}poll();
