import {lazy,Suspense,useState} from 'react';
import honours from '../source/player-honours.json';
import {TrophyCabinet} from './TrophyCabinet';
const HeroFog=lazy(()=>import('./HeroFog'));
const BrushedAward=lazy(()=>import('./BrushedAward'));
const awards=honours.filter(a=>a.playerId==='903b6ff9-90bc-11f1-8aff-7bff69c6eb8e').sort((a,b)=>b.season.localeCompare(a.season)||a.kind.localeCompare(b.kind));
export function PremiumExperiments(){
  const [fog,setFog]=useState(true),[status,setStatus]=useState('loading');
  return <section className="premium-experiments" id="premium"><h2>Materiaalit ja syvyys · kokeilu</h2><p>Lauren Heard · Peli-Karhut. Oikeat palkintomerkinnät, tyylitellyt 3D-esineet.</p>
    <TrophyCabinet awards={awards}/>
    <div className="premium-samples"><article className="fog-sample"><div className="premium-sample-header"><h3>Heron utu</h3><button onClick={()=>setFog(v=>!v)} aria-pressed={fog}>{fog?'Utu päällä':'Utu pois'}</button></div><div className="fog-sample-stage">{fog&&<Suspense fallback={null}><HeroFog onStatus={setStatus} reduced={window.matchMedia('(prefers-reduced-motion: reduce)').matches}/></Suspense>}<div className="fog-sample-card"><span>Yleiskatsaus</span><strong>74,4</strong><small>Pisteet / ottelu</small></div></div><p>{status==='fallback'?'Tämä selain käyttää staattista varataustaa.':'Tumma siniharmaa, hidas liike. Ei hiiren seuraamista.'}</p></article>
    <article className="metal-sample"><h3>Harjattu metalli</h3><div className="metal-sample-body"><Suspense fallback={<div className="brushed-award"/>}><BrushedAward/></Suspense><div><strong>Kulta</strong><p>Rauhallinen heijastus, hieno pintatekstuuri. Kaapin 3D-palkinnoissa sama materiaalin suunta.</p></div></div><p>Shader Effects · BrushedMetal. Kaappi: Three.js ja oikeat metallimateriaalit.</p></article></div>
  </section>;
}
