import {scheduleByMatchId} from './schedule.ts';
// Preserve verified records and the exact playing time used by the original calculator.
export function matchupRecords(games){return games.filter(g=>g.verified).map(g=>({game:{source_id:g.id,scheduled_at:g.date??scheduleByMatchId[g.id]??null},teams:g.teams.map(t=>({...t,source_id:t.id,players:t.players.map(p=>({...p,source_player_id:p.id,display_name:p.name,minutes:p.minutesValue}))}))}));}
