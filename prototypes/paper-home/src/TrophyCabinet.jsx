import {useEffect,useRef,useState} from 'react';
import {t as translate} from './i18n';
import './premium-effects.css';

export function TrophyCabinet({awards,compact=false}) {
  const host=useRef(null),[status,setStatus]=useState('loading');
  const visible=awards.slice(0,6);
  const key=visible.map(a=>`${a.label}:${a.season}`).join('|');
  const groups=Object.values(awards.reduce((all,award)=>{
    (all[award.label]??={label:award.label,kind:award.kind,awards:[]}).awards.push(award);
    return all;
  },{}));
  useEffect(()=>{
    let cancelled=false,instance;
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(e=>e.isIntersecting)||instance||cancelled)return;
      observer.disconnect();
      try {
        const {createCabinet}=await import('./lib/trophyScene');
        if(cancelled)return;
        instance=createCabinet(host.current,visible,()=>setStatus('fallback'));
        setStatus('ready');
      }catch(error){if(!cancelled)setStatus('fallback');}
    },{rootMargin:'100px'});
    observer.observe(host.current);
    return ()=>{cancelled=true;observer.disconnect();instance?.dispose();};
  },[key]);
  return <div className={`trophy-experiment ${compact?'trophy-compact':''}`}>
    <div ref={host} className="trophy-viewport" role="img" aria-label={translate('Kolmiulotteinen palkintokaappi')} data-render-state={status}>
      {status==='loading'&&<span className="trophy-loading">{translate('Palkintokaappi')}</span>}
      {status==='fallback'&&<p>{translate('3D-näkymä ei ole käytettävissä tällä laitteella. Palkinnot näkyvät alla.')}</p>}
    </div>
    <ul className="trophy-records" aria-label={translate('Palkinnot')}>
      {groups.map(group=><li key={group.label} className={group.kind==='championship'?'trophy-championship':''}>
        <strong>{translate(group.label)}</strong>
        <div>{[...group.awards].sort((a,b)=>b.season.localeCompare(a.season)).map(award=><a key={award.season} href={award.sourceUrl} target="_blank" rel="noreferrer" aria-label={translate(`${award.label} · ${award.season.replace('-','–')} · Lähde: Basket.fi`)} title={translate('Lähde: Basket.fi')}>{award.season.replace('-','–')}</a>)}</div>
      </li>)}
    </ul>
    {!compact&&<p className="trophy-hint">{translate('Todelliset palkintomerkinnät, tyylitellyt esineet. Kausiluku avaa lähteen.')}</p>}
  </div>;
}
