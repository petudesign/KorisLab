import {t as translate,locale} from './i18n';
import {TeamLogo} from './TeamLogo';
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined';
import './home-comparison.css';

const format=n=>n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
const measures=[
 {key:'efg_pct',label:'Heittotehokkuus',unit:'eFG %',hint:'Kolmosen lisäarvo mukana',lower:false},
 {key:'offensive_rebound_pct',label:'Toiset mahdollisuudet',unit:'ORB %',hint:'Osuus hyökkäyspään levypalloista',lower:false},
 {key:'turnover_pct',label:'Pallon säilyttäminen',unit:'TOV %',hint:'Menetyksiä / 100 pallonhallintaa',lower:true},
];

export function HomeComparison({a,b,onOverview}){
 return <div className="analysis-example play-comparison">
  <div className="play-teams">{translate([a,b].map((team,index)=><div className={`play-team play-team-${index}`} key={team.name}>
   <TeamLogo name={team.name}/><div><h3>{translate(team.name)}</h3><span><b>{translate(format(team.per_game.points))}</b>{translate(" pistettä / ottelu")}</span></div>
  </div>))}</div>
  <div className="play-factors">{translate(measures.map(metric=>{
   const x=a.metrics[metric.key],y=b.metrics[metric.key],difference=Math.abs(x-y);
   const winner=x===y?null:(metric.lower?x<y:x>y)?a:b;
   return <div className="play-factor" key={metric.key}>
    <header><span>{translate(metric.unit)}</span><span className="play-difference">{translate(format(difference))}{translate(" %")}</span></header>
    <h4>{translate(metric.label)}</h4><p>{translate(metric.hint)}</p>
    <div className="play-bars">{translate([x,y].map((value,index)=><div key={index} className={`play-bar play-bar-${index}`} aria-label={translate(`${index===0?a.name:b.name}: ${format(value)} prosenttia`)}>
     <div><i style={{width:`${Math.min(100,value)}%`}}/></div><strong>{translate(format(value))}<small>{translate("%")}</small></strong>
    </div>))}</div>
    <span className="play-edge">{translate(winner?`${winner.name} · ${metric.lower?'vähemmän menetyksiä':'korkeampi osuus'}`:'Sama osuus')}</span>
   </div>;
  }))}</div>
  <div className="play-bottom"><span>{translate("Kauden keskiarvot · värit vastaavat joukkueita")}</span><button className="home-text-link" onClick={onOverview}>{translate("Vertaa joukkueita ")}<ArrowOutwardOutlined/></button></div>
 </div>;
}
