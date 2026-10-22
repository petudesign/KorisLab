import {t as translate} from './i18n';
import {useState} from 'react';
import {sortTableRows} from './lib/tableSort';
import './table-sort.css';
export function useTableSort(columns,initialKey,initialDirection='desc'){
 const [sort,setSort]=useState({key:initialKey,direction:initialDirection});
 const change=key=>setSort(previous=>({key,direction:previous.key===key?(previous.direction==='desc'?'asc':'desc'):(columns.find(c=>c.key===key)?.text?'asc':'desc')}));
 return {sort,change,rows:rows=>sortTableRows(rows,columns,sort)};
}
export function SortHeaders({columns,sorting}){return <>{translate(columns.map(c=><th key={c.key} scope="col" aria-sort={sorting.sort.key===c.key?(sorting.sort.direction==='asc'?'ascending':'descending'):'none'}><button className="table-sort-heading" onClick={()=>sorting.change(c.key)} aria-label={translate(`Järjestä: ${c.label}`)} title={translate(`Järjestä: ${c.label}`)}>{translate(c.label)}<span aria-hidden="true">{translate(sorting.sort.key===c.key?(sorting.sort.direction==='asc'?'↑':'↓'):'↕')}</span></button></th>))}</>;}
export function TableSortMenu({columns,sorting,label='Listan järjestys'}){return <div className="table-sort-menu"><label>{translate("Järjestä")}<select aria-label={translate(label)} value={sorting.sort.key} onChange={e=>sorting.change(e.target.value)}>{translate(columns.map(c=><option key={c.key} value={c.key}>{translate(c.label)}</option>))}</select></label><button onClick={()=>sorting.change(sorting.sort.key)} aria-label={translate(`${label}: ${sorting.sort.direction==='desc'?'suurin ensin':'pienin ensin'}, vaihda suunta`)} title={translate("Vaihda järjestyssuunta")}>{translate(sorting.sort.direction==='desc'?'↓':'↑')}</button></div>;}
