export function projectPlayerShot(shot,court='half'){
 if(shot.x==null||shot.y==null)return null;
 if(court==='full')return {x:shot.x*5.6,y:shot.y*3};
 return {x:shot.x<=50?300-shot.y*3:shot.y*3,y:Math.min(shot.x,100-shot.x)*5.6};
}
