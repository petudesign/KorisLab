import {useEffect,useState} from 'react';
import {Shader,Fog} from 'shaders/react';

// Purely decorative. The existing static haze remains if WebGPU is unavailable.
export default function HeroFog({className='',reduced=false,onStatus}) {
  const [unavailable,setUnavailable]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{onStatus?.(unavailable||reduced?'fallback':'loading');},[unavailable,reduced,onStatus]);
  return <div className={`premium-fog ${className}`} aria-hidden="true" data-shader-state={unavailable||reduced?'fallback':ready?'ready':'loading'}>
    {!unavailable&&!reduced&&<Shader disableTelemetry className="premium-fog-canvas" onReady={()=>{setReady(true);onStatus?.('ready');}} onUnavailable={()=>setUnavailable(true)}>
      <Fog colorA="#233f4c" colorB="#080e12" speed={reduced?0:0.12} turbulence={0.18} detail={5} blending={0.85} mouseInfluence={0}/>
    </Shader>}
  </div>;
}
