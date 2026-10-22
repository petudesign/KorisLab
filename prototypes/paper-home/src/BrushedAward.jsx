import {useState} from 'react';
import {Shader,BrushedMetal} from 'shaders/react';
export default function BrushedAward(){const [failed,setFailed]=useState(false),[ready,setReady]=useState(false);return <div className={`brushed-award ${ready?'shader-ready':''}`} aria-hidden="true">{!failed&&<Shader disableTelemetry className="brushed-award-canvas" onReady={()=>setReady(true)} onUnavailable={()=>setFailed(true)}><BrushedMetal shape="sphere3D" lightColor="#efd5a0" darkColor="#493620" grain={0.28} grainScale={3} roughness={0.48} anisotropy={0.65} speed={0} scale={1.35}/></Shader>}</div>;}
