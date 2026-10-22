import {t as translate,locale} from './i18n';
import {useMatches} from './useMatches';
import {HighlightTrend} from './SeasonHighlights';
import {overviewRecentPoints} from './lib/overviewPoints';
const fmt=n=>n.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1});
const date=d=>new Date(d).toLocaleDateString(locale(),{day:'numeric',month:'numeric'});
export function OverviewPointsTrend({matchesUrl,teamId,average}){
 const {games,error}=useMatches(matchesUrl);
 if(error)return <span className="overview-points-note">{translate("Ottelukäyrää ei voitu ladata.")}</span>;
 if(!games)return <span className="overview-points-note" role="status">{translate("Ladataan ottelukäyrää…")}</span>;
 const recent=overviewRecentPoints(games,teamId),values=recent.map(g=>g.points);
 if(!recent.length)return <span className="overview-points-note">{translate("Ei vielä pelattuja otteluita.")}</span>;
 return <span className="overview-points-trend" style={{'--highlight-accent':'#df945b'}}>
  <span className="overview-points-note">{translate(teamId==='league'?'Ottelun pistekeskiarvo / joukkue':'Joukkueen pisteet ottelussa')}</span>
  <HighlightTrend games={recent} metric="points" average={average} unit="PTS"/>
  <span className="overview-points-range"><span>{translate("Min ")}<b>{translate(fmt(Math.min(...values)))}</b></span><span>{translate("Max ")}<b>{translate(fmt(Math.max(...values)))}</b></span></span>
  <span className="overview-points-dates"><span>{translate(date(recent[0].date))}</span><span>{translate(date(recent.at(-1).date))}</span></span>
  <span className="overview-points-note overview-points-baseline">{translate("Katkoviiva: kauden KA ")}{translate(fmt(average))}</span>
 </span>;
}
