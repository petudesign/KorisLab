export function sortTableRows(rows,columns,sort){
 const column=columns.find(c=>c.key===sort.key);
 if(!column)return [...rows];
 return [...rows].sort((a,b)=>{
  const av=column.value(a),bv=column.value(b);
  const missing=v=>v==null||(typeof v==='number'&&!Number.isFinite(v));
  if(missing(av)||missing(bv))return missing(av)?(missing(bv)?0:1):-1;
  const result=typeof av==='string'?av.localeCompare(String(bv),'fi',{numeric:true}):av-bv;
  return result*(sort.direction==='asc'?1:-1);
 });
}
